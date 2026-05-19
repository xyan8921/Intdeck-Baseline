/**
 * Payment Skill 类型定义
 * 
 * 支付作为 Workflow 的标准 Skill 步骤，全程符合 E1–E6 伦理原则
 * 
 * @see [伦理宪章](../../../../ETHICS.md)
 * @see [开发者伦理指南](../../../../docs/ethics-guidelines.md)
 * @see [智能执行系统规范](../../../../docs/Intdone%20智能执行系统规范.md)
 */

import { SkillInput, SkillOutput } from '../types';

/**
 * 支付模式
 */
export type PaymentMode =
  | 'c_redirect' // C端跳转支付（Stage 0 主路径，规避二清风险）
  | 'c_managed_mock' // C端模拟代付（Stage 0 Mock）
  | 'b_immediate' // B端现结
  | 'b_net30'; // B端账期

/**
 * 商户信息
 */
export interface Vendor {
  /** 商户唯一ID，如 "cake-shop-123" */
  id: string;
  /** 商户名称（用于E3透明展示） */
  name: string;
  /** 商品类目（用于E1风控） */
  category: string;
  /** 资质编号（可选） */
  license?: string;
}

/**
 * 企业合约（B端）
 */
export interface EnterpriseContract {
  /** 账期类型 */
  billingTerms: 'immediate' | 'net30';
  /** 白名单商户ID */
  approvedVendors: string[];
  /** 是否需审批 */
  requiresApproval: boolean;
}

/**
 * Payment Skill 输入
 */
export interface PaymentInput extends SkillInput {
  // === 金额与商户 ===
  /** 金额（单位：分），如 20000 = ¥200 */
  amount: number;
  /** 货币类型 */
  currency: 'CNY';
  /** 商户信息 */
  vendor: Vendor;

  // === 支付模式（由上下文动态决定）===
  /** 支付模式 */
  mode: PaymentMode;

  // === 上下文绑定 ===
  /** 用户声明的上下文 */
  userDeclaredContext?: 'personal' | 'work';
  /** 企业合约（B端） */
  enterpriseContract?: EnterpriseContract;

  // === 意图关联 ===
  /** 意图ID，用于审计追踪 */
  intentId: string;
}

/**
 * Payment Skill 输出
 */
export interface PaymentOutput extends SkillOutput {
  /** 内容：支付结果 */
  content: {
    /** 交易号（Mock 时为 fake_id） */
    transactionId: string;
    /** 支付状态 */
    status: 'mock' | 'success' | 'pending' | 'failed';
    /** 撤销令牌（E4：随时保持回退） */
    undoToken: `pay_undo_${string}`;
  };
  /** 格式标识 */
  format: 'payment';
  /** 元数据 */
  metadata: {
    /** Skill ID */
    skillId: string;
    /** 时间戳 */
    timestamp: number;
    /** 置信度（E3：支付为确定性操作，通常为 1.0） */
    confidence: number;
    /** 免责声明（E3：用户透明说明） */
    disclaimer: string; // e.g. "¥200 已模拟支付给【XX蛋糕店】"
    /** 可退款时间窗口（E4：资金级回退） */
    refundableUntil: Date; // 如 15 分钟内
    /** 审计追踪（E6：最小化审计） */
    auditTrail: {
      intentId: string;
      userId?: string;
      timestamp: Date;
      mode: PaymentMode;
      amount: number;
      vendorId: string;
    };
  };
}

/**
 * 退款服务接口
 */
export interface IRefundService {
  /**
   * 撤销支付（E4：随时保持回退）
   * @param undoToken 撤销令牌
   * @returns 退款结果
   */
  undo(undoToken: string): Promise<RefundResult>;
}

/**
 * 退款结果
 */
export interface RefundResult {
  /** 退款状态 */
  status: 'refunded' | 'failed' | 'expired';
  /** 退款金额（单位：分） */
  amount?: number;
  /** 退款时间 */
  refundedAt?: Date;
  /** 错误信息（如有） */
  error?: string;
}
