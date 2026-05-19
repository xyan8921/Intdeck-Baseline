/**
 * LLM 适配器接口定义
 * 确保不同 LLM 提供商的实现可以无缝切换
 */

export interface StructuredOutput {
  title: string;
  content: string;
  sections?: Array<{
    title: string;
    content: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface LLMError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * LLM 适配器接口
 * Stage 0: MockLLMAdapter 实现
 * Stage 1: QwenMaxAdapter / GPT4Adapter 实现
 */
export interface LLMAdapter {
  /**
   * 格式化 Prompt 模板
   */
  formatPrompt(template: string, params: Record<string, unknown>): string;

  /**
   * 解析 LLM 响应为结构化输出
   */
  parseResponse(response: unknown): StructuredOutput;

  /**
   * 计算成本（tokens）
   */
  getCost(tokens: number): number;

  /**
   * 获取最大 token 限制
   */
  getMaxTokens(): number;

  /**
   * 处理错误
   */
  handleError(error: unknown): LLMError;

  /**
   * 生成内容
   */
  generate(prompt: string, scenario?: string): Promise<StructuredOutput>;

  /**
   * 获取可用场景列表（用于示例场景切换）
   */
  getAvailableScenarios?(): string[];
}
