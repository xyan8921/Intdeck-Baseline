/**
 * LocalContentShield - 本地内容审核实现
 * 
 * Stage 0: 使用本地敏感词库和正则规则进行内容审核
 * Stage 1: 迁移到 AliyunContentShield（阿里云内容安全）
 * 
 * ⚠️ 重要：ContentShield 仅用于输出过滤，不用于用户输入拦截（避免 E2 对抗）
 * 
 * @see [伦理宪章](../../../ETHICS.md)
 * @see [开发者伦理指南](../../../docs/ethics-guidelines.md)
 */

import { IContentShield, ShieldResult } from './types';
import {
  ETHICS_RULE_E1_SHIELD_BLOCKLIST_HIT,
  ETHICS_RULE_E1_SHIELD_IMAGE_UNSUPPORTED,
  ETHICS_RULE_E1_SHIELD_REGEX_HIT,
} from './ruleIds';

/**
 * LocalContentShield 实现
 * 
 * 使用本地敏感词库和正则规则进行内容审核
 */
export class LocalContentShield implements IContentShield {
  private blocklist: Set<string> = new Set();
  private regexRules: RegExp[] = [];
  private initialized = false;

  /**
   * 初始化内容审核器
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.loadBlocklist();
    this.initRegexRules();
    this.initialized = true;
  }

  /**
   * 确保已初始化
   */
  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * 检查文本内容
   * 
   * ⚠️ 注意：仅用于输出过滤，不用于用户输入拦截（避免 E2 对抗）
   * 
   * @param text 待检查的文本
   * @returns 审核结果
   */
  async checkText(text: string): Promise<ShieldResult> {
    await this.ensureInit();

    // 敏感词检查
    const lowerText = text.toLowerCase();
    for (const word of this.blocklist) {
      if (word === '成人' && /(成人协助|成人在场|由成人|仅成人|需成人)/.test(text)) {
        // 家庭/活动安全语境下的“成人”不应被判为色情语义
        continue;
      }
      if (lowerText.includes(word.toLowerCase())) {
        return {
          passed: false,
          reason: `包含敏感词：${word}`,
          level: 'high',
          rulesTriggered: [ETHICS_RULE_E1_SHIELD_BLOCKLIST_HIT],
        };
      }
    }

    // 正则规则检查
    for (const rule of this.regexRules) {
      if (rule.test(text)) {
        return {
          passed: false,
          reason: '内容违反审核规则',
          level: 'medium',
          rulesTriggered: [ETHICS_RULE_E1_SHIELD_REGEX_HIT],
        };
      }
    }

    return { passed: true };
  }

  /**
   * 检查图像内容
   * 
   * ⚠️ Stage 0: 不支持真实图像生成，强化边界提示
   * 
   * @param _image 待检查的图像文件（Stage 0 未使用）
   * @returns 审核结果（Stage 0 始终返回不通过）
   */
  async checkImage(_image: File): Promise<ShieldResult> {
    await this.ensureInit();

    // Stage 0: 不支持真实图像生成，强化边界提示
    return {
      passed: false,
      reason: 'Stage 0 不支持图像生成',
      level: 'low',
      rulesTriggered: [ETHICS_RULE_E1_SHIELD_IMAGE_UNSUPPORTED],
    };
  }

  /**
   * 加载敏感词库
   * 
   * 优先尝试从远程 HTTPS 公开 URL 加载（可选优化）
   * 失败时降级到本地文件
   */
  private async loadBlocklist(): Promise<void> {
    // 可选：从远程加载（如 GitHub Raw）
    // const remoteBlocklistUrl = 'https://raw.githubusercontent.com/xyan8921/Intdone/main/public/blocklist.txt';
    // try {
    //   const response = await fetch(remoteBlocklistUrl, {
    //     cache: 'no-cache',
    //     headers: { 'Accept': 'text/plain' },
    //   });
    //   if (response.ok) {
    //     const text = await response.text();
    //     const words = text.split('\n').filter(line => line.trim());
    //     this.blocklist = new Set(words);
    //     return;
    //   }
    // } catch (error) {
    //   console.warn('Failed to load remote blocklist, falling back to local:', error);
    // }

    // 降级到本地文件
    try {
      const response = await fetch('/blocklist.txt');
      if (response.ok) {
        const text = await response.text();
        const words = text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('#'));
        this.blocklist = new Set(words);
      } else {
        throw new Error(`Failed to load blocklist: ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Failed to load blocklist from local file, using default:', error);
      // 使用默认敏感词（包含 LLM 幻觉关键词）
      this.blocklist = new Set([
        // 基础敏感词
        '暴力',
        '色情',
        '赌博',
        '毒品',
        '诈骗',
        // LLM 幻觉关键词
        '据我所知',
        '毫无疑问',
        '绝对正确',
        '我可以确定',
        '这是事实',
      ]);
    }
  }

  /**
   * 初始化正则规则
   */
  private initRegexRules(): void {
    // 联系方式正则（防止泄露个人信息）
    this.regexRules.push(/\d{11}/); // 手机号（11位数字）
    this.regexRules.push(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/); // 邮箱

    // 其他规则可以在这里添加
    // 例如：银行卡号、身份证号等
  }

  /**
   * 获取当前敏感词库大小（用于调试）
   */
  getBlocklistSize(): number {
    return this.blocklist.size;
  }
}

/**
 * 全局单例
 */
export const localContentShield = new LocalContentShield();
