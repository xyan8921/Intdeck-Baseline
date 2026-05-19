/**
 * 预置模板加载器
 * 
 * 从 public/preset-templates.json 加载 Scenario 模板
 * 
 * @see [智能执行系统规范](../../../docs/Intdone%20智能执行系统规范.md)
 */

import { Scenario } from './types';

/**
 * 预置模板加载器
 */
export class PresetLoader {
  private templates: Scenario[] | null = null;
  private loadPromise: Promise<Scenario[]> | null = null;

  /**
   * 加载所有预置模板
   */
  async loadAll(): Promise<Scenario[]> {
    if (this.templates) {
      return this.templates;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this._loadFromFile();
    this.templates = await this.loadPromise;
    return this.templates;
  }

  /**
   * 根据 ID 获取模板
   */
  async getTemplate(id: string): Promise<Scenario | null> {
    const templates = await this.loadAll();
    return templates.find(t => t.id === id) || null;
  }

  /**
   * 根据分类获取模板列表
   */
  async getTemplatesByCategory(category: 'C端' | 'B端'): Promise<Scenario[]> {
    const templates = await this.loadAll();
    return templates.filter(t => t.category === category);
  }

  /**
   * 搜索模板（根据名称或场景）
   */
  async searchTemplates(keyword: string): Promise<Scenario[]> {
    const templates = await this.loadAll();
    const lowerKeyword = keyword.toLowerCase();
    return templates.filter(
      t =>
        t.name.toLowerCase().includes(lowerKeyword) ||
        (t.scenario && t.scenario.toLowerCase().includes(lowerKeyword))
    );
  }

  /**
   * 从文件加载模板
   */
  private async _loadFromFile(): Promise<Scenario[]> {
    try {
      const response = await fetch('/preset-templates.json');
      if (!response.ok) {
        throw new Error(`Failed to load templates: ${response.statusText}`);
      }

      const data = await response.json();
      
      // 验证数据格式
      if (!Array.isArray(data)) {
        throw new Error('preset-templates.json must be an array');
      }

      // 转换为 Scenario 类型（添加扩展字段）
      return data.map((item: Record<string, unknown>) => ({
        id: String(item.id ?? ''),
        name: String(item.name ?? ''),
        category: (item.category === 'B端' || item.category === 'C端' ? item.category : 'C端') as Scenario['category'],
        promptTemplate: String(item.promptTemplate ?? ''),
        workflowId: String(item.workflowId ?? ''),
        skills: (item.skills as string[]) || [],
        ethicalPrinciples: (item.ethicalPrinciples || []) as ('E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6')[],
        scenario: item.scenario as string | undefined,
        exampleOutput: item.exampleOutput,
      })) as Scenario[];
    } catch (error) {
      console.error('Failed to load preset templates:', error);
      throw error;
    }
  }

  /**
   * 清除缓存（用于开发时热重载）
   */
  clearCache(): void {
    this.templates = null;
    this.loadPromise = null;
  }
}

/**
 * 全局单例
 */
export const presetLoader = new PresetLoader();
