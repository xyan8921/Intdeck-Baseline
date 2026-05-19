import type { ClarifyQuestion } from '../types';

export interface AiTemplateConfig {
  templateId: string;
  /** 可选：用于 generic-keyword 等通用路径按子类命中配置 */
  subCategoryId?: string;
  clarifyQuestions: ClarifyQuestion[];
  planTasks: Array<{ id: string; title: string; status: string }>;
  planMilestones: Array<{ id: string; title: string; at: string }>;
  variations: Array<{ id: string; title: string; description: string }>;
  keywords: { list: string[]; brief: string };
}
