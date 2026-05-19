/**
 * Intdone 智能体的"自我认知"对象
 * 所有核心模块必须通过此对象获取运行时上下文
 * 
 * @see [伦理宪章](../../../ETHICS.md)
 * @see [开发者伦理指南](../../../docs/ethics-guidelines.md)
 */

/**
 * 系统元信息接口
 * 定义 Intdone 智能体的身份、能力、合规状态和运行时上下文
 */
export interface SystemMeta {
  // === 身份标识 ===
  /** 系统标识符 */
  id: 'intdone-core';
  /** 版本号，如 "0.1.0" */
  version: string;
  /** 当前阶段 */
  stage: 'stage0' | 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5';

  // === 运行环境 ===
  /** 运行环境：本地或云端 */
  environment: 'local' | 'cloud';
  /** 区域：影响合规策略 */
  region: 'cn' | 'global';

  // === 能力声明（关键！控制功能开关）===
  /** 系统能力配置 */
  capabilities: {
    /** 是否启用真实 LLM（Stage 0 = false） */
    llm: boolean;
    /** 是否支持支付 */
    payment: boolean;
    /** 是否允许调用外部 API */
    thirdPartyAPI: boolean;
    /** 用户数据存储方式 */
    userStorage: 'local' | 'cloud';
  };

  // === 合规与伦理 ===
  /** 伦理配置 */
  ethics: {
    /** 伦理宪章版本，如 "v1.1" */
    charterVersion: string;
    /** 启用的伦理原则 */
    principles: ('E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6')[];
    /** 是否强制启用回退机制（E4） */
    enforceFallback: boolean;
  };
  /** 合规配置 */
  compliance: {
    /** 内容审核提供者 */
    contentShield: 'local' | 'aliyun' | 'none';
    /** 数据驻留位置 */
    dataResidency: 'user-device' | 'china' | 'global';
    /** 是否启用审计日志 */
    auditLogging: boolean;
  };

  // === 当前会话上下文（运行时更新）===
  /** 运行时上下文 */
  context: {
    /** 用户 ID（Stage 1+ 才有） */
    userId?: string;
    /** 用户类型：B端或C端 */
    userType: 'B' | 'C';
    /** 当前激活的 Scenario ID */
    scenarioId?: string;
  };
}

function resolveCoreVersion(): string {
  try {
    const v = (import.meta as ImportMeta & { env?: { VITE_APP_VERSION?: string } }).env?.VITE_APP_VERSION;
    if (v) return v;
  } catch {
    // ignore（Node/CLI 等非 Vite 打包环境）
  }
  if (typeof process !== 'undefined' && process.env.npm_package_version) {
    return process.env.npm_package_version;
  }
  return '0.1.0';
}

/**
 * 创建系统元信息（默认 **运行时 stage0**：本地优先、无真实 LLM/无三方 API 等契约）
 */
export function createSystemMeta(overrides?: Partial<SystemMeta>): SystemMeta {
  const defaultMeta: SystemMeta = {
    id: 'intdone-core',
    version: resolveCoreVersion(),
    stage: 'stage0',
    environment: 'local',
    region: 'cn',
    capabilities: {
      llm: false, // Stage 0 禁用真实 LLM
      payment: false, // Stage 0 不支持支付
      thirdPartyAPI: false, // Stage 0 禁止外部 API
      userStorage: 'local', // Stage 0 仅本地存储
    },
    ethics: {
      charterVersion: 'v1.1',
      principles: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'], // 启用所有原则
      enforceFallback: true, // 强制启用回退机制
    },
    compliance: {
      contentShield: 'local', // Stage 0 使用本地审核
      dataResidency: 'user-device', // Stage 0 数据仅存用户设备
      auditLogging: false, // Stage 0 不启用审计日志
    },
    context: {
      userType: 'C', // 默认 C 端
    },
  };

  return { ...defaultMeta, ...overrides };
}

/**
 * 验证系统元信息是否符合 Stage 0 要求
 */
export function validateStage0Meta(meta: SystemMeta): boolean {
  // Stage 0 必须满足的条件
  if (meta.stage !== 'stage0') return false;
  if (meta.capabilities.llm !== false) return false;
  if (meta.capabilities.payment !== false) return false;
  if (meta.capabilities.thirdPartyAPI !== false) return false;
  if (meta.capabilities.userStorage !== 'local') return false;
  if (meta.compliance.contentShield !== 'local') return false;
  if (meta.compliance.dataResidency !== 'user-device') return false;
  if (meta.environment !== 'local') return false;

  return true;
}
