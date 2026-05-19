/**
 * Payment Skill 实现
 * 
 * 支付作为 Workflow 的标准 Skill 步骤，全程符合 E1–E6 伦理原则
 * 
 * Stage 0: Mock 实现
 * Stage 2+: 真实支付集成
 * 
 * @see [伦理宪章](../../../../ETHICS.md)
 * @see [智能执行系统规范](../../../../docs/Intdone%20智能执行系统规范.md)
 */

import { Skill, SkillInput, SkillOutput } from '../types';
import { SystemMeta } from '../../system/types';
import { PaymentInput, PaymentOutput } from './types';

/**
 * 伦理错误
 */
export class EthicalError extends Error {
  constructor(
    message: string,
    public readonly principle: 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'EthicalError';
  }
}

/**
 * Payment Skill 实现
 */
export class PaymentSkill implements Skill {
  id = 'payment-processor';
  type = 'payment' as const; // 支付 Skill 类型
  metadata = {
    name: '支付处理',
    description: '处理支付请求，支持 C/B 端多模式，具备资金级回退能力',
    requiresNetwork: false, // Stage 0 为 false，Stage 2+ 为 true
    ethicalPrinciples: ['E1', 'E2', 'E3', 'E4', 'E6'] as ('E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6')[],
  };

  /**
   * 执行支付
   */
  async execute(input: SkillInput, meta: SystemMeta): Promise<SkillOutput> {
    // 类型转换与验证
    const paymentInput = this.validatePaymentInput(input);

    // === E1: 伦理拦截 ===
    this.ethicalGuard(paymentInput, meta);

    // === E2: 不对抗检查 ===
    this.checkUserSovereignty(paymentInput, meta);

    // === 生成撤销令牌（E4）===
    const undoToken = this.generateUndoToken();

    // === Mock 支付处理（Stage 0）===
    if (!meta.capabilities.payment) {
      return this.executeMockPayment(paymentInput, meta, undoToken);
    }

    // === 真实支付处理（Stage 2+）===
    // TODO: 集成真实支付网关
    throw new Error('Real payment not implemented in Stage 0');
  }

  /**
   * E1: 伦理拦截
   */
  private ethicalGuard(input: PaymentInput, _meta: SystemMeta): void {
    // E1: 禁止高风险类目
    const forbiddenCategories = ['tobacco', 'alcohol', 'gambling'];
    if (forbiddenCategories.includes(input.vendor.category)) {
      throw new EthicalError(
        `E1: 不支持该商品类目 "${input.vendor.category}"`,
        'E1',
        { category: input.vendor.category }
      );
    }

    // E1: B端合约校验
    if (input.userDeclaredContext === 'work') {
      if (!input.enterpriseContract) {
        throw new EthicalError(
          'E1: 企业支付需有效合约',
          'E1',
          { userDeclaredContext: input.userDeclaredContext }
        );
      }

      // 检查商户白名单
      if (
        input.enterpriseContract.approvedVendors.length > 0 &&
        !input.enterpriseContract.approvedVendors.includes(input.vendor.id)
      ) {
        throw new EthicalError(
          `E1: 商户 "${input.vendor.name}" 不在企业白名单中`,
          'E1',
          { vendorId: input.vendor.id }
        );
      }
    }

    // E1: 金额合理性检查
    if (input.amount <= 0) {
      throw new EthicalError(
        'E1: 支付金额必须大于 0',
        'E1',
        { amount: input.amount }
      );
    }
    // 超过 10 万元需额外审批（可选，Stage 2+ 实现）
    // if (input.amount > 10000000) {
    //   throw new EthicalError('E1: 支付金额超出合理范围，需额外审批', 'E1', { amount: input.amount });
    // }
  }

  /**
   * E2: 不对抗检查
   */
  private checkUserSovereignty(input: PaymentInput, meta: SystemMeta): void {
    // E2: C端默认跳转支付，不诱导代付
    if (input.userDeclaredContext === 'personal' && input.mode !== 'c_redirect') {
      // Stage 0 仅支持跳转支付，规避二清风险
      if (meta.stage === 'stage0' || meta.stage === 'stage1') {
        throw new EthicalError(
          'E2: C端支付需跳转到合作平台，不代付',
          'E2',
          { mode: input.mode }
        );
      }
    }
  }

  /**
   * 执行 Mock 支付（Stage 0）
   */
  private executeMockPayment(
    input: PaymentInput,
    meta: SystemMeta,
    undoToken: `pay_undo_${string}`
  ): PaymentOutput {
    const transactionId = `mock_tx_${Date.now()}_${this.randomString(8)}`;
    const amountYuan = (input.amount / 100).toFixed(2);

    // E3: 生成免责声明
    const disclaimer = this.generateDisclaimer(input, amountYuan, transactionId);

    // E4: 设置可退款时间窗口（15 分钟）
    const refundableUntil = new Date(Date.now() + 15 * 60 * 1000);

    return {
      content: {
        transactionId,
        status: 'mock' as const,
        undoToken,
      },
      format: 'payment',
      metadata: {
        skillId: this.id,
        timestamp: Date.now(),
        confidence: 1.0, // 支付为确定性操作
        disclaimer,
        refundableUntil,
        auditTrail: {
          intentId: input.intentId,
          userId: meta.context.userId,
          timestamp: new Date(),
          mode: input.mode,
          amount: input.amount,
          vendorId: input.vendor.id,
        },
      },
    };
  }

  /**
   * 生成免责声明（E3）
   */
  private generateDisclaimer(
    input: PaymentInput,
    amountYuan: string,
    transactionId: string
  ): string {
    if (input.mode === 'c_redirect') {
      return `⚠️ **模拟支付**：¥${amountYuan} 将跳转至【${input.vendor.name}】完成支付。交易号：${transactionId}`;
    } else if (input.mode === 'c_managed_mock') {
      return `⚠️ **模拟代付**：¥${amountYuan} 已模拟支付给【${input.vendor.name}】。交易号：${transactionId}（可撤销）`;
    } else if (input.mode === 'b_immediate') {
      return `⚠️ **B端现结（模拟）**：¥${amountYuan} 已模拟支付给【${input.vendor.name}】。交易号：${transactionId}`;
    } else {
      return `⚠️ **B端账期（模拟）**：¥${amountYuan} 将计入【${input.vendor.name}】账期。交易号：${transactionId}`;
    }
  }

  /**
   * 生成撤销令牌（E4）
   */
  private generateUndoToken(): `pay_undo_${string}` {
    const timestamp = Date.now();
    const random = this.randomString(8);
    return `pay_undo_${timestamp}_${random}`;
  }

  /**
   * 验证并转换 PaymentInput
   */
  private validatePaymentInput(input: SkillInput): PaymentInput {
    if (!input.amount || typeof input.amount !== 'number') {
      throw new Error('PaymentInput.amount is required and must be a number');
    }
    if (!input.vendor || typeof input.vendor !== 'object') {
      throw new Error('PaymentInput.vendor is required');
    }
    if (!input.intentId || typeof input.intentId !== 'string') {
      throw new Error('PaymentInput.intentId is required');
    }
    return input as PaymentInput;
  }

  /**
   * 生成随机字符串
   */
  private randomString(length: number): string {
    return Math.random().toString(36).substring(2, 2 + length);
  }
}
