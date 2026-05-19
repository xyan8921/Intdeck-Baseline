/**
 * Mock 退款服务（Stage 0）
 * 
 * 实现 E4（随时保持回退）原则的资金级回退能力
 */

import { IRefundService, RefundResult } from './types';

/**
 * Mock 退款服务实现
 */
export class MockRefundService implements IRefundService {
  private refundedTokens: Set<string> = new Set();

  /**
   * 撤销支付
   */
  async undo(undoToken: string): Promise<RefundResult> {
    // 验证 token 格式
    if (!undoToken.startsWith('pay_undo_')) {
      return {
        status: 'failed',
        error: 'Invalid undo token format',
      };
    }

    // 检查是否已退款
    if (this.refundedTokens.has(undoToken)) {
      return {
        status: 'failed',
        error: 'Payment already refunded',
      };
    }

    // 解析 token 获取时间戳
    const parts = undoToken.split('_');
    if (parts.length < 3) {
      return {
        status: 'failed',
        error: 'Invalid undo token format',
      };
    }

    const timestamp = parseInt(parts[2], 10);
    const now = Date.now();
    const ageMinutes = (now - timestamp) / (1000 * 60);

    // 检查退款时间窗口（15 分钟）
    if (ageMinutes > 15) {
      return {
        status: 'expired',
        error: 'Refund window expired (15 minutes)',
      };
    }

    // 执行退款
    this.refundedTokens.add(undoToken);

    console.log(`[MOCK] Refunding payment: ${undoToken}`);

    return {
      status: 'refunded',
      amount: 0, // Mock 模式下金额为 0
      refundedAt: new Date(),
    };
  }

  /**
   * 检查 token 是否已退款
   */
  isRefunded(undoToken: string): boolean {
    return this.refundedTokens.has(undoToken);
  }

  /**
   * 清除退款记录（用于测试）
   */
  clear(): void {
    this.refundedTokens.clear();
  }
}
