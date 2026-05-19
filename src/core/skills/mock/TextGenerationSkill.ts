/**
 * Stage 0 示例：Mock 文本生成 Skill
 *
 * 实现 E1（内容审核）、E3（置信度标注）、E5（多样性）原则
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- Mock: static JSON / theme payloads; tighten types when schema stabilizes */

import { Skill, SkillInput, SkillOutput } from '../types';
import { SystemMeta } from '../../system/types';
import { localContentShield } from '../../shield/LocalContentShield';
import { appendUnifiedAuditRingEvent } from '../../observability/unifiedAuditRingLog';
import { buildUnifiedAuditEventV1 } from '../../observability/unifiedAuditSchema';

/**
 * Mock 文本生成 Skill
 * Stage 0 使用预置模板生成文本方案
 */
export class TextGenerationSkill implements Skill {
  id = 'text-generation';
  type = 'text' as const;
  metadata = {
    name: '文本方案生成',
    description: '基于模板生成派对/活动文案',
    requiresNetwork: false, // Stage 0 无网络依赖
    ethicalPrinciples: ['E1', 'E3', 'E5'] as ('E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6')[],
  };
  private homeRepairIndexCache:
    | { themes: Array<{ id: string; title: string; keywords: string[]; shard: string }> }
    | null = null;
  private homeRepairShardCache: Record<
    string,
    Record<string, { content: string; contentPro?: string; contentProPath?: string; metadata?: any }>
  > = {};
  /** 最近使用的 shard 键（LRU），避免主题增多后内存无限增长 */
  private homeRepairShardLru: string[] = [];
  private readonly HOME_REPAIR_SHARD_CACHE_MAX = 6;
  private eventPlanningIndexCache:
    | { themes: Array<{ id: string; title: string; keywords: string[]; sourcePath?: string; shard?: string }> }
    | null = null;
  private eventPlanningShardCache: Record<
    string,
    Record<string, { content: string; contentPro?: string; contentProPath?: string; metadata?: any }>
  > = {};
  private eventPlanningShardLru: string[] = [];
  private readonly EVENT_PLANNING_SHARD_CACHE_MAX = 4;

  /**
   * 执行文本生成
   */
  async execute(input: SkillInput, meta: SystemMeta): Promise<SkillOutput> {
    // E3: 返回置信度
    const confidence = meta.stage === 'stage0' ? 0.9 : 0.95;

    // E1: 模拟内容审核
    const prompt = typeof input.prompt === 'string' ? input.prompt : '';
    if (prompt.includes('违法') || prompt.includes('暴力')) {
      appendUnifiedAuditRingEvent(
        buildUnifiedAuditEventV1({
          rulesTriggered: [],
          verdict: 'block',
          reason: '内容违反 E1 原则：包含违规关键词（Stage0 prompt 闸）',
          correlation: { channel: 'skill_prompt_keyword_stub', skillId: this.id },
          surfaceHint: 'content_shield',
        })
      );
      throw new Error('内容违反 E1 原则：包含违规关键词');
    }

    // 生成 Mock 响应（异步加载）
    const mockData = await this._generateMockContent(input, meta);
    let content: string;
    let mockMetadata: any = null;
    
    if (typeof mockData === 'string') {
      content = mockData;
    } else {
      content = mockData.content;
      mockMetadata = mockData.metadata || null;
    }

    // E1: 内容审核（后置检查 - 检查生成的内容）
    // ⚠️ 注意：ContentShield 仅用于输出过滤，不用于用户输入拦截（避免 E2 对抗）
    const shieldResult = await localContentShield.checkText(content);
    if (!shieldResult.passed) {
      appendUnifiedAuditRingEvent(
        buildUnifiedAuditEventV1({
          rulesTriggered: shieldResult.rulesTriggered ?? [],
          verdict: 'block',
          reason: shieldResult.reason,
          correlation: { channel: 'skill_output_shield', skillId: this.id },
        })
      );
      throw new Error(`内容审核未通过：${shieldResult.reason}`);
    }

    // E3/E6: 稳定可复用的后处理（关键风险块 + 参数缺失兜底）
    // 统一输出形态，后续新增风险策略只需要改这里即可扩展。
    const finalContent = await this._postProcessGeneratedMarkdown(content, input);

    return {
      content: finalContent,
      format: 'text/markdown',
      metadata: {
        ...(mockMetadata || {}),
        skillId: this.id,
        timestamp: Date.now(),
        confidence: mockMetadata?.confidence || confidence,
        disclaimer: mockMetadata?.disclaimer || this._getDisclaimer(input, meta),
      },
    };
  }

  /**
   * 生成 Mock 内容
   */
  private async _generateMockContent(input: SkillInput, _meta: SystemMeta): Promise<string | { content: string; metadata?: any }> {
    const prompt = typeof input.prompt === 'string' ? input.prompt : '';
    const scenario = typeof input.scenario === 'string' ? input.scenario : '';
    const templateId = typeof input.templateId === 'string' ? input.templateId : scenario;

    // 2.2.2 增强：generic-keyword 走参数驱动自然语言模板，避免占位骨架口吻
    if (templateId === 'generic-keyword') {
      const themed = await this._tryLoadThemeForGenericKeyword(prompt);
      if (themed) {
        return themed;
      }
      return this._getGenericKeywordDrivenTemplate(prompt);
    }

    // 优先尝试从 Mock 响应文件加载（使用 templateId）
    if (templateId) {
      try {
        const mockResponse = await this._loadMockResponse(templateId, prompt);
        if (mockResponse) {
          return mockResponse;
        }
      } catch (error) {
        console.warn(`Failed to load mock response for ${templateId}:`, error);
      }
    }

    // 降级到硬编码模板
    if (scenario === 'dinosaur-party' || prompt.includes('恐龙')) {
      return this._getDinosaurPartyTemplate();
    } else if (scenario === 'recruitment' || prompt.includes('招聘')) {
      return this._getRecruitmentTemplate();
    }

    // 默认通用模板
    return this._getGenericTemplate();
  }

  private async _tryLoadThemeForGenericKeyword(
    prompt: string
  ): Promise<{ content: string; metadata?: any } | null> {
    const subCategory = this._extractByPrefix(prompt, '子类 ID：') || '';
    const normalized = this._normalizeForMatch(prompt);
    // 当前主题库先覆盖 ProblemSolving / personal-life-admin 链路
    if (subCategory === 'personal-life-admin') {
      return this._loadHomeRepairThemeResponse(prompt);
    }
    // Celebration / social-gathering：走活动主题索引（可持续扩展，不再写死）
    if (
      subCategory === 'social-gathering' ||
      normalized.includes(this._normalizeForMatch('恐龙派对')) ||
      normalized.includes('dinosaur')
    ) {
      const themed = await this._loadEventPlanningThemeResponse(prompt);
      if (themed) return themed;
      if (normalized.includes(this._normalizeForMatch('恐龙派对')) || normalized.includes('dinosaur')) {
        return {
          content: this._getDinosaurPartyTemplate(),
          metadata: {
            source: 'event-theme-hardcoded-fallback',
            themeId: 'dinosaur-party',
            themeTitle: '恐龙主题生日派对',
          },
        };
      }
    }
    return null;
  }

  private async _loadEventPlanningThemeResponse(
    prompt: string
  ): Promise<{ content: string; metadata?: any } | null> {
    try {
      const index = await this._loadEventPlanningIndex();
      if (!index || !index.themes || index.themes.length === 0) return null;

      const id = this._inferEventThemeId(prompt, index.themes);
      const target = index.themes.find((t) => t.id === id) ?? index.themes[0];
      let theme: { content: string; metadata?: any } | null = null;
      if (target.sourcePath) {
        const response = await fetch(target.sourcePath);
        if (response.ok) {
          const data = await response.json();
          theme = {
            content: typeof data.content === 'string' ? data.content : JSON.stringify(data, null, 2),
            metadata: data.metadata,
          };
        }
      } else if (target.shard) {
        theme = await this._loadEventPlanningThemeFromShard(target.shard, target.id);
      }
      if (!theme) return null;
      const tier = this._resolveOutputTier(prompt);
      const selectedContent = await this._resolveTieredContent(theme, tier);
      if (!selectedContent) return null;
      return {
        content: selectedContent,
        metadata: {
          ...(theme.metadata || {}),
          source: 'event-theme-index',
          themeId: target.id,
          themeTitle: target.title,
          outputTier: tier,
        },
      };
    } catch {
      return null;
    }
  }

  private async _loadEventPlanningIndex(): Promise<{
    themes: Array<{ id: string; title: string; keywords: string[]; sourcePath?: string; shard?: string }>;
  } | null> {
    if (this.eventPlanningIndexCache) return this.eventPlanningIndexCache;
    const response = await fetch('/mock-responses/event-planning/themes/index.json');
    if (!response.ok) return null;
    const json = await response.json();
    if (!json || !Array.isArray(json.themes)) return null;
    this.eventPlanningIndexCache = {
      themes: json.themes
        .filter((t: any) => t && typeof t.id === 'string' && typeof t.title === 'string')
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          shard: typeof t.shard === 'string' ? t.shard : undefined,
          sourcePath: typeof t.sourcePath === 'string' ? t.sourcePath : undefined,
          keywords: Array.isArray(t.keywords) ? t.keywords.filter((k: any) => typeof k === 'string') : [],
        })),
    };
    return this.eventPlanningIndexCache;
  }

  private async _loadEventPlanningThemeFromShard(
    shard: string,
    themeId: string
  ): Promise<{ content: string; contentPro?: string; contentProPath?: string; metadata?: any } | null> {
    if (!this.eventPlanningShardCache[shard]) {
      const response = await fetch(`/mock-responses/event-planning/themes/${shard}`);
      if (!response.ok) return null;
      const json = await response.json();
      const map: Record<string, { content: string; contentPro?: string; contentProPath?: string; metadata?: any }> = {};
      if (Array.isArray(json?.themes)) {
        for (const t of json.themes) {
          if (t && typeof t.id === 'string' && typeof t.content === 'string') {
            map[t.id] = {
              content: t.content,
              contentPro: typeof t.contentPro === 'string' ? t.contentPro : undefined,
              contentProPath: typeof t.contentProPath === 'string' ? t.contentProPath : undefined,
              metadata: t.metadata,
            };
          }
        }
      }
      this.eventPlanningShardCache[shard] = map;
    }
    this._touchEventPlanningShard(shard);
    return this.eventPlanningShardCache[shard][themeId] ?? null;
  }

  private _touchEventPlanningShard(shard: string): void {
    this.eventPlanningShardLru = [shard, ...this.eventPlanningShardLru.filter((s) => s !== shard)];
    while (this.eventPlanningShardLru.length > this.EVENT_PLANNING_SHARD_CACHE_MAX) {
      const evict = this.eventPlanningShardLru.pop();
      if (evict) delete this.eventPlanningShardCache[evict];
    }
  }

  private _inferEventThemeId(
    prompt: string,
    themes: Array<{ id: string; title: string; keywords: string[] }>
  ): string {
    const text = this._normalizeForMatch(String(prompt || ''));
    let bestId = themes[0]?.id || '';
    let bestScore = -1;
    for (const t of themes) {
      let score = 0;
      const normalizedTitle = this._normalizeForMatch(t.title);
      if (normalizedTitle && text.includes(normalizedTitle)) score += 100;
      for (const kw of t.keywords) {
        const normalizedKw = this._normalizeForMatch(kw);
        if (normalizedKw && text.includes(normalizedKw)) score += Math.max(1, normalizedKw.length / 2);
      }
      if (score > bestScore) {
        bestScore = score;
        bestId = t.id;
      }
    }
    return bestId;
  }

  /**
   * 从 Mock 响应文件加载内容
   */
  private async _loadMockResponse(
    templateId: string,
    prompt = ''
  ): Promise<{ content: string; metadata?: any } | null> {
    if (templateId === 'home-repair') {
      const selected = await this._loadHomeRepairThemeResponse(prompt);
      if (selected) return selected;
    }

    // 根据 templateId 映射到具体的 Mock 文件路径
    const templateMockMap: Record<string, string[]> = {
      'dinosaur-party': [
        '/mock-responses/event-planning/dinosaur-party.json',
        '/mock-responses/dinosaur-party.json',
      ],
      'event-planning': [
        '/mock-responses/event-planning/generic-event.json',
      ],
      'home-repair': [
        '/mock-responses/home-repair/fix-leaky-faucet.json',
      ],
      'travel-planning': [
        '/mock-responses/travel-planning/hangzhou-trip.json',
      ],
      'study-plan': [
        '/mock-responses/study-plan/exam-prep.json',
      ],
      'recruitment': [
        '/mock-responses/recruitment/job-description.json',
        '/mock-responses/recruitment.json',
      ],
      'generic-keyword': ['/mock-responses/generic-keyword.json'],
    };

    // 优先使用模板映射的路径
    const paths = templateMockMap[templateId] || [
      // 如果没有映射，尝试通用路径
      `/mock-responses/${templateId}/${templateId}.json`,
      `/mock-responses/${templateId}/default.json`,
      `/mock-responses/${templateId}.json`,
    ];

    for (const path of paths) {
      try {
        const response = await fetch(path);
        if (response.ok) {
          const data = await response.json();
          return {
            content: typeof data.content === 'string' ? data.content : JSON.stringify(data, null, 2),
            metadata: data.metadata,
          };
        }
      } catch (error) {
        // 继续尝试下一个路径
        continue;
      }
    }

    return null;
  }

  private async _loadHomeRepairThemeResponse(
    prompt: string
  ): Promise<{ content: string; metadata?: any } | null> {
    try {
      const index = await this._loadHomeRepairIndex();
      if (!index || !index.themes || index.themes.length === 0) return null;

      const id = this._inferHomeRepairThemeId(prompt, index.themes);
      const target = index.themes.find((t) => t.id === id) ?? index.themes[0];
      const theme = await this._loadHomeRepairThemeFromShard(target.shard, target.id);
      if (!theme) return null;
      const tier = this._resolveOutputTier(prompt);
      const selectedContent = await this._resolveTieredContent(theme, tier);
      if (!selectedContent) return null;
      return {
        content: selectedContent,
        metadata: {
          ...(theme.metadata || {}),
          source: 'home-repair-theme-shard',
          themeId: target.id,
          themeTitle: target.title,
          outputTier: tier,
        },
      };
    } catch {
      return null;
    }
  }

  private async _loadHomeRepairIndex(): Promise<{ themes: Array<{ id: string; title: string; keywords: string[]; shard: string }> } | null> {
    if (this.homeRepairIndexCache) return this.homeRepairIndexCache;
    const response = await fetch('/mock-responses/home-repair/themes/index.json');
    if (!response.ok) return null;
    const json = await response.json();
    if (!json || !Array.isArray(json.themes)) return null;
    this.homeRepairIndexCache = {
      themes: json.themes
        .filter((t: any) => t && typeof t.id === 'string' && typeof t.title === 'string' && typeof t.shard === 'string')
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          shard: t.shard,
          keywords: Array.isArray(t.keywords) ? t.keywords.filter((k: any) => typeof k === 'string') : [],
        })),
    };
    return this.homeRepairIndexCache;
  }

  private async _loadHomeRepairThemeFromShard(
    shard: string,
    themeId: string
  ): Promise<{ content: string; contentPro?: string; contentProPath?: string; metadata?: any } | null> {
    if (!this.homeRepairShardCache[shard]) {
      const response = await fetch(`/mock-responses/home-repair/themes/${shard}`);
      if (!response.ok) return null;
      const json = await response.json();
      const map: Record<string, { content: string; contentPro?: string; contentProPath?: string; metadata?: any }> = {};
      if (Array.isArray(json?.themes)) {
        for (const t of json.themes) {
          if (t && typeof t.id === 'string' && typeof t.content === 'string') {
            map[t.id] = {
              content: t.content,
              contentPro: typeof t.contentPro === 'string' ? t.contentPro : undefined,
              contentProPath: typeof t.contentProPath === 'string' ? t.contentProPath : undefined,
              metadata: t.metadata,
            };
          }
        }
      }
      this.homeRepairShardCache[shard] = map;
    }
    this._touchHomeRepairShard(shard);
    return this.homeRepairShardCache[shard][themeId] ?? null;
  }

  private _touchHomeRepairShard(shard: string): void {
    this.homeRepairShardLru = [shard, ...this.homeRepairShardLru.filter((s) => s !== shard)];
    while (this.homeRepairShardLru.length > this.HOME_REPAIR_SHARD_CACHE_MAX) {
      const evict = this.homeRepairShardLru.pop();
      if (evict) delete this.homeRepairShardCache[evict];
    }
  }

  private _inferHomeRepairThemeId(
    prompt: string,
    themes: Array<{ id: string; title: string; keywords: string[] }>
  ): string {
    const text = this._normalizeForMatch(String(prompt || ''));
    let bestId = themes[0]?.id || '';
    let bestScore = -1;
    for (const t of themes) {
      let score = 0;
      const normalizedTitle = this._normalizeForMatch(t.title);
      // 标题强命中优先，减少“客厅软装灰尘控制”这类完整主题漏命中
      if (normalizedTitle && text.includes(normalizedTitle)) {
        score += 100;
      }
      for (const kw of t.keywords) {
        if (!kw) continue;
        const normalizedKw = this._normalizeForMatch(kw);
        if (!normalizedKw) continue;
        if (text.includes(normalizedKw)) score += Math.max(1, normalizedKw.length / 2);
      }
      if (score > bestScore) {
        bestScore = score;
        bestId = t.id;
      }
    }
    return bestId;
  }

  private _normalizeForMatch(text: string): string {
    return String(text || '')
      .toLowerCase()
      .replace(/[\s`~!@#$%^&*()_\-+=\x5b\x5d{}|\\;:'",.<>/?，。！？；：“”‘’（）【】《》、]/g, '');
  }

  private _resolveOutputTier(prompt: string): 'standard' | 'pro' {
    const normalized = this._normalizeForMatch(prompt);
    if (
      /内容档位\s*[:：]\s*pro/i.test(prompt) ||
      /输出档位\s*[:：]\s*pro/i.test(prompt) ||
      normalized.includes('内容档位pro') ||
      normalized.includes('输出档位pro') ||
      normalized.includes('详细版') ||
      normalized.includes('完整版')
    ) {
      return 'pro';
    }
    return 'standard';
  }

  private async _resolveTieredContent(
    theme: { content: string; contentPro?: string; contentProPath?: string },
    tier: 'standard' | 'pro'
  ): Promise<string | null> {
    if (tier !== 'pro') return theme.content;
    if (typeof theme.contentPro === 'string' && theme.contentPro.trim()) return theme.contentPro;
    if (typeof theme.contentProPath === 'string' && theme.contentProPath.trim()) {
      try {
        const response = await fetch(theme.contentProPath);
        if (response.ok) {
          const text = await response.text();
          if (text.trim()) return text;
        }
      } catch {
        // ignore and fallback to standard
      }
    }
    return theme.content;
  }

  /**
   * 获取免责声明（E1/E3 要求）
   */
  private _getDisclaimer(input: SkillInput, _meta: SystemMeta): string | undefined {
    const prompt = typeof input.prompt === 'string' ? input.prompt : '';
    
    // 高风险领域检测
    if (/医疗|治疗|诊断|投资|理财|法律|诉讼|合同/.test(prompt)) {
      return '⚠️ **免责声明**：此方案由 AI 生成，不构成专业建议。请咨询持证专业人士。';
    }

    return undefined;
  }

  /**
   * 恐龙派对模板
   */
  private _getDinosaurPartyTemplate(): string {
    // 恐龙派对主题：三套并列可选方案（互不冲突）
    return `# 恐龙主题生日派对方案（备选三套）

以下方案围绕“恐龙”主题展开，可根据预算/空间/家长参与度选择其一或组合使用（不要求优先级）。

## 方案一：全包式活动策划模板（event-planning）
此模板旨在为用户提供一站式派对规划，从概念到执行细节，确保所有环节都围绕“恐龙”主题展开。

【方案名称】：重返侏罗纪——沉浸式恐龙主题派对全案
【用户痛点/目标】： 想要举办一场令人难忘的恐龙主题派对（如儿童生日），但不知从何下手，需要一份详细的执行清单。

【模板输出结构】
### 派对概览（Party Overview）
- 派对主题口号：咆哮吧！欢迎来到侏罗纪公园
- 目标人群：5-8岁儿童（用户填写：可调整）
- 建议时长：2.5 - 3 小时
- 核心氛围：探险、神秘、趣味、科普

### 场景与布置（Decor & Atmosphere）
- 入口设计：恐龙蛋孵化区——用绿色气球和充气恐龙蛋堆砌入口；签到板设计为考古挖掘现场。
- 餐桌布置：丛林食盆——迷彩桌布；餐具使用树叶纹理；中心装饰物为蕨类植物（真或假）+塑料小恐龙。
- 灯光音效：播放丛林环境音（鸟叫、远处恐龙低吼）；灯光调暗并使用绿色/橙色氛围灯。

### 餐饮方案（Dino Menu）
- 主食：霸王龙爪（炸鸡翅/鸡腿）；恐龙化石（意面肉丸）。
- 甜点：恐龙蛋（抹茶味麻薯或白色巧克力球）；火山爆发（红色果冻蛋糕）。
- 饮品：史前泥浆（绿色奇异果奶昔）；琥珀药水（苹果汁）。

### 活动流程（Run of Show）
- 14:00 - 签到与换装：发放恐龙尾巴和头饰，脸部彩绘（画鳞片）。
- 14:30 - 破冰游戏：恐龙木头人 或 喂食霸王龙（投掷游戏，确保安全距离）。
- 15:15 - 核心环节：寻找丢失的恐龙蛋（寻宝游戏，线索藏在叶子下）。
- 16:00 - 能量补给：切蛋糕，享用“史前大餐”。
- 16:30 - 伴手礼：赠送装有恐龙玩具与化石挖掘 kits 的探险背包。

### 购物与准备清单（Checklist）
- 装饰品采购清单：绿色/棕色气球、恐龙蛋装饰、蕨类植物
- 食材采购清单：炸鸡翅/鸡腿、意面与肉丸食材、麻薯/巧克力球、果冻蛋糕、奇异果与苹果汁材料
- 游戏道具准备：恐龙木头人所需道具（可选）、投掷游戏道具、寻宝线索卡、化石挖掘 kits

## 方案二：问题解决与 DIY 指南模板（home-repair）
此模板侧重动手制作，解决“如何低成本打造逼真恐龙场景”的问题，强调步骤与材料。

【方案名称】：DIY 侏罗纪——如何在家制作巨型纸板恐龙
【用户痛点/目标】：购买成品恐龙道具太贵且占地，希望通过家庭常见的废旧材料（纸箱）亲手制作一个震撼的派对主角。

【模板输出结构】
### 项目简介（Project Brief）
- 难度等级：中等（需成人协助）
- 预计耗时：3-4 小时
- 所需空间：客厅或车库

### 材料清单（Materials Needed）
- 核心材料：3-5个大号家电纸箱（冰箱/洗衣机包装）
- 工具：美工刀（仅成人使用）、宽胶带、热熔胶枪（仅成人使用）、丙烯颜料（绿/褐/黄）
- 配件：两个塑料杯子（做眼睛）、旧报纸（填充用）

### 分步施工指南（Step-by-Step Guide）
- 步骤一：骨架搭建。将纸板裁切成条状，弯曲成恐龙脊椎与肋骨结构，用胶带固定成拱形（可形成类似隧道，让孩子钻进去）。
- 步骤二：头部制作。利用纸箱棱角制作三角龙或霸王龙的头部，预留视线孔。
- 步骤三：皮肤处理。将报纸揉皱贴在骨架上塑造肌肉感，覆盖一层牛皮纸作为“皮肤”。
- 步骤四：上色与纹理。涂刷底色，用海绵拍打深色颜料制造鳞片质感，最后画上爪痕。

### 避坑指南（Pro Tips）
- 连接处务必使用热熔胶加固，防止倒塌。
- 纸板边缘务必用胶带包边，防止划伤儿童。
- 设定“安全边界区”：切割/上胶/上色过程不让幼童靠近。

### 最终效果展示（Result）
一个可互动的、孩子可以骑乘或躲藏的巨型纸板恐龙，成为派对合影的绝对 C 位。

## 方案三：创意内容与教育模板（creative-writing & study-plan）
此模板侧重软性内容，通过故事线与知识卡片，提升派对文化内涵和互动深度。

【方案名称】：小小古生物学家的冒险——派对故事线与知识卡
【用户痛点/目标】：派对不想只是吃吃喝喝，希望通过故事引导与科普，让孩子们在玩中学，增加派对的记忆点。

【模板输出结构】
### 背景故事设定（The Narrative）
- 故事引子：各位探险家，时空机器发生了故障，我们将大家带回了6500万年前的白垩纪。你们现在的任务是：找到三种不同食性的恐龙（食草、食肉、杂食），收集它们的“基因样本”（贴纸），才能修复机器回到现代！

### 角色设定卡（Character Cards - 可打印）
- 迅猛龙小队：敏捷、聪明（适合活泼的孩子）
- 腕龙卫士：强壮、温和（适合稳重的孩子）
- 翼龙侦察兵：视野开阔、自由（适合喜欢观察的孩子）

### 互动知识问答（Trivia & Quiz）
- 问题1：哪种恐龙的脖子最长？（答案：腕龙/马门溪龙）
- 问题2：霸王龙的前爪有几根手指？（答案：两根）
- 问题3：恐龙灭绝是因为什么？（答案：小行星撞击）

### 任务卡模板（Mission Cards）
- 任务A（观察）：找到派对现场隐藏的“蕨类植物”，并画出它的样子。
- 任务B（模仿）：模仿霸王龙的叫声和走路姿势，坚持30秒。
- 任务C（逻辑）：将混在一起的“肉食恐龙”和“素食恐龙”卡片分类。

### 结营证书（Certificate）
- 文案：兹证明【孩子名字】成功完成了侏罗纪探险任务，特授予“荣誉古生物学家”称号。

## 关键风险提醒（必读）
- **成人监护**：儿童派对中切割、热熔胶、热源、登高布置等环节须由成人操作；全程保持成人可见监护。
- **食物与安全**：如现场有餐食，事先确认过敏与不耐受；避免整颗坚果、果冻类窒息风险；冷热饮分区标识。
- **游戏与动线**：投掷、奔跑、钻爬类环节预留安全距离与人数上限；地面防滑，尖锐道具与气球碎片及时清理。
- **小零件与道具**：恐龙玩具、挖掘套件等含小零件时，按年龄分层使用，低龄儿童需在成人看护下玩耍。
- 本模板仅为通用活动策划建议，不替代场地安全评估、消防与治安等专业意见。`;
  }

  /**
   * 招聘模板
   */
  private _getRecruitmentTemplate(): string {
    return `# 前端开发工程师招聘JD

## 职位描述
我们正在寻找一位经验丰富的前端开发工程师，加入我们的技术团队。

## 任职要求
1. 3年以上前端开发经验
2. 熟练掌握 React/Vue 等主流前端框架
3. 熟悉 TypeScript、ES6+
4. 有良好的代码规范和团队协作能力

## 薪资待遇
15K-25K，五险一金，带薪年假，定期团建`;
  }

  /**
   * 通用模板
   */
  private _getGenericTemplate(): string {
    return `# 方案生成

基于您的需求，我们为您生成了以下方案：

## 方案概述
[方案内容]

## 实施步骤
1. [步骤一]
2. [步骤二]
3. [步骤三]

## 注意事项
- 请根据实际情况调整方案
- 如有疑问，请咨询相关专业人士`;
  }

  private _getGenericKeywordDrivenTemplate(prompt: string): string {
    const category = this._extractByPrefix(prompt, '意图大类：') || 'ProblemSolving';
    const subCategory = this._extractByPrefix(prompt, '子类 ID：') || 'generic';
    const entries = this._extractKeyValueBullets(prompt);
    const externalSeedRaw = this._extractByPrefix(prompt, 'seed：') || this._extractByPrefix(prompt, 'Seed：') || '';
    const baseSeed = this._hash32(`${category}|${subCategory}|${JSON.stringify(entries)}`);
    const seed = externalSeedRaw.trim()
      ? this._hash32(`${baseSeed}|external-seed|${externalSeedRaw.trim()}`)
      : baseSeed;
    const rng = this._createSeededRng(seed);

    const budget = entries.budget || entries.totalBudget || '';
    const headcount = entries.guestCount || entries.headcount || entries.people || '';
    const theme = entries.theme || entries.style || '';
    const goal = entries.goal || entries.target || '';
    const deadline = entries.deadline || entries.date || '';
    const playbook = this._getPlaybookByCategory(category, rng);
    const opening = this._pick(playbook.opening, rng);
    const close = this._pick(playbook.close, rng);

    const overviewParts = [
      goal
        ? this._pick([`核心目标为「${goal}」`, `当前优先达成「${goal}」`, `本轮以「${goal}」为主线`], rng)
        : this._pick(['以当前意图目标为核心', '按用户输入目标推进', '先围绕主要目标收敛范围'], rng),
      theme ? this._pick([`主题建议使用「${theme}」`, `风格可统一为「${theme}」`, `表达基调采用「${theme}」`], rng) : '',
      budget
        ? this._pick(
            [`预算暂按 ${budget} 规划`, `预算基线先设为 ${budget}`, `成本上限优先参考 ${budget}`],
            rng
          )
        : this._pick(['预算先按分阶段估算', '成本先拆成必要项与弹性项', '预算口径建议先确认后再扩展'], rng),
      headcount
        ? this._pick([`预计人数约 ${headcount}`, `参与规模约 ${headcount}`, `预估人数为 ${headcount}`], rng)
        : '',
      deadline
        ? this._pick([`目标时间为 ${deadline}`, `排期节点参考 ${deadline}`, `交付时间暂定 ${deadline}`], rng)
        : '',
    ].filter(Boolean);

    const step2 = budget
      ? this._pick(
          [
            `按预算拆成必要项（约 ${budget} 的 60%）与优化项（约 ${budget} 的 40%），先锁定必要项。`,
            `围绕 ${budget} 预算先列刚需清单，再按优先级扩展可选项。`,
          ],
          rng
        )
      : this._pick(
          [
            '先拆分必要项与可选项，确保在可接受成本内完成核心目标。',
            '在预算未明确前，先按最小可行范围执行，避免一次性展开过大。',
          ],
          rng
        );
    const step3 = headcount
      ? this._pick(
          [
            `围绕约 ${headcount} 人规模安排资源与时间窗口，优先确认关键参与方。`,
            `按 ${headcount} 人规模预估场地/物料/协作节奏，先完成关键节点锁定。`,
          ],
          rng
        )
      : this._pick(
          [
            '先确认关键参与方与最小可执行范围，再扩展细节。',
            '先建立负责人与协作链路，避免后续信息分散导致返工。',
          ],
          rng
        );
    const step4 = this._pick(playbook.step4, rng);

    return `# 关键词驱动执行方案（${category} / ${subCategory}）

## 目标与约束摘要
${opening}：${overviewParts.join('，')}。

## 建议执行步骤
1. ${this._pick(playbook.step1, rng)}
2. ${step2}
3. ${step3}
4. ${step4}

## 参数快照
${Object.keys(entries).length > 0 ? Object.entries(entries).map(([k, v]) => `- ${k}: ${v}`).join('\n') : '- （当前未填写参数）'}

## 提示
- 当前为规则化自然语言生成（非 LLM），可审计、可复现（seed=${seed}${externalSeedRaw.trim() ? `; externalSeed=${externalSeedRaw.trim()}` : ''}）。
- ${close}`;
  }

  private async _postProcessGeneratedMarkdown(
    content: string,
    input: SkillInput
  ): Promise<string> {
    const existingRiskHeading = '## 关键风险提醒（必读）';
    if (content.includes(existingRiskHeading)) return content;

    const prompt = typeof input.prompt === 'string' ? input.prompt : '';
    const riskCtx = this._detectRiskContext(prompt, content);
    const bullets = this._buildRiskBullets(riskCtx);

    // 稳定可复用：固定段落结构，避免下游展示样式不一致。
    const riskBlock = [
      existingRiskHeading,
      ...bullets.map((b) => `- ${b}`),
    ].join('\n');

    return `${content}\n\n---\n\n${riskBlock}`;
  }

  private _detectRiskContext(prompt: string, content: string): {
    isChildrenOrKids: boolean;
    isDIYWithTools: boolean;
    mentionsFood: boolean;
  } {
    const text = `${prompt}\n${content}`;
    const isChildrenOrKids = /(儿童|孩子|小朋友|幼儿)/.test(text);

    // DIY/工具风险信号（命中即认为需要成人安全监护）
    const isDIYWithTools = /(热熔胶|胶枪|美工刀|刀具|剪刀|胶带|缝纫|打孔|钻|电钻|锯|烙铁|火|明火)/.test(
      text
    );

    const mentionsFood = /(食物|蛋糕|甜点|饮品|奶昔|果冻|意面|炸鸡|鸡腿|苹果汁|奇异果)/.test(text);

    return { isChildrenOrKids, isDIYWithTools, mentionsFood };
  }

  private _buildRiskBullets(ctx: {
    isChildrenOrKids: boolean;
    isDIYWithTools: boolean;
    mentionsFood: boolean;
  }): string[] {
    const bullets: string[] = [];

    // 儿童/玩耍场景通用风险
    if (ctx.isChildrenOrKids) {
      bullets.push('成人需在场监督；避免尖锐边缘、碎屑、小零件误吞/误吸。');
    } else {
      bullets.push('注意参与者人身安全，设置安全边界与明确的行为规则。');
    }

    // DIY 工具与热源风险
    if (ctx.isDIYWithTools) {
      bullets.push('涉及切割/热熔胶/热源的步骤由成人操作；使用时保持通风并避免烫伤。');
    }

    // 食物与过敏风险
    if (ctx.mentionsFood) {
      bullets.push('如存在过敏史或特殊饮食需求，请事先确认食材；避免混用不明食物。');
    }

    // 环境与动线风险
    bullets.push('提前检查现场动线与地面防滑；投掷/奔跑类环节设置安全距离与人数上限。');

    // 伦理与边界
    bullets.push('以上为活动策划建议，不构成医疗/法律/安全专业意见；如需更高安全等级请咨询专业人士。');

    return bullets;
  }

  private _getPlaybookByCategory(
    category: string,
    _rng: () => number
  ): {
    opening: string[];
    step1: string[];
    step4: string[];
    close: string[];
  } {
    if (category === 'Celebration') {
      return {
        opening: ['建议优先统一活动调性', '可以先确定活动主线', '建议先明确活动体验目标'],
        step1: ['先定义活动成功标准（体验/参与度/预算达成）并写成检查项。'],
        step4: ['形成执行清单（负责人/时间/验收），并在活动前做一次彩排或演练。'],
        close: ['如果需要更有氛围感的方案，可补充主题、人数与场地信息后再生成。'],
      };
    }
    if (category === 'Learning') {
      return {
        opening: ['建议先收敛学习目标', '可先固定学习主线', '建议先明确阶段达成标准'],
        step1: ['先确定阶段目标与衡量方式（分数/时长/完成率），并设置每周复盘点。'],
        step4: ['将任务拆成周计划与日计划，并给每项设置可检查的完成标准。'],
        close: ['如需更细化学习节奏，可补充科目、每天时长和当前水平。'],
      };
    }
    return {
      opening: ['建议先聚焦问题闭环', '可先收敛关键约束', '建议先确认可执行范围'],
      step1: ['先定义问题边界与可接受结果，避免执行过程反复扩张范围。'],
      step4: ['输出可执行清单并设定检查节点，先跑最小闭环再迭代优化。'],
      close: ['如需更贴合业务语境，可补充目标、限制与优先级后再生成。'],
    };
  }

  private _extractByPrefix(text: string, prefix: string): string {
    const line = text.split('\n').find((l) => l.startsWith(prefix));
    return line ? line.slice(prefix.length).trim() : '';
  }

  private _extractKeyValueBullets(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t.startsWith('- ')) continue;
      const body = t.slice(2);
      const idx = body.indexOf(':');
      if (idx <= 0) continue;
      const key = body.slice(0, idx).trim();
      const value = body.slice(idx + 1).trim();
      if (key) out[key] = value;
    }
    return out;
  }

  private _hash32(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  private _createSeededRng(seed: number): () => number {
    let s = seed || 1;
    return () => {
      // xorshift32
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 1000000) / 1000000;
    };
  }

  private _pick<T>(arr: T[], rng: () => number): T {
    if (arr.length === 0) {
      throw new Error('empty candidate list');
    }
    const idx = Math.floor(rng() * arr.length) % arr.length;
    return arr[idx];
  }
}
