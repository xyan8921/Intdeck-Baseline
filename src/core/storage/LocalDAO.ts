/**
 * LocalDAO - IndexedDB 实现
 * 
 * Stage 0: 使用 IndexedDB 存储用户数据（Intent、Solution、Template）
 * Stage 1: 迁移到 CloudDAO（PostgreSQL via API）
 * 
 * 特性：
 * - 版本迁移支持（v1 → v2）
 * - 内存降级策略（IndexedDB 失败时使用内存存储）
 * - 完整的 CRUD 操作
 * 
 * @see [开发计划](../../../docs/意达（Intdone）开发计划.md)
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { IDAO, Intent, MetaTemplate, Solution } from './types';
import { normalizeIntent, stampIntentForSave } from './intentNormalize';

/**
 * IndexedDB 数据库结构定义
 */
interface IntdoneDB extends DBSchema {
  intents: {
    key: string;
    value: Intent;
    indexes: { 'by-createdAt': Date };
  };
  templates: {
    key: string;
    value: MetaTemplate;
  };
  solutions: {
    key: string;
    value: Solution;
    indexes: { 'by-intentId': string; 'by-createdAt': Date };
  };
}

/**
 * LocalDAO 实现
 * 
 * 使用 IndexedDB 存储数据，失败时降级到内存存储
 */
export class LocalDAO implements IDAO {
  private db: IDBPDatabase<IntdoneDB> | null = null;
  private memoryFallback: {
    intents: Map<string, Intent>;
    templates: Map<string, MetaTemplate>;
    solutions: Map<string, Solution>;
  } = {
    intents: new Map(),
    templates: new Map(),
    solutions: new Map(),
  };
  private initialized = false;

  /**
   * 初始化数据库
   * 
   * 包含版本迁移策略和降级处理
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.db = await openDB<IntdoneDB>('intdone-db', 2, {
        async upgrade(db, oldVersion, _newVersion, transaction) {
          if (oldVersion < 1) {
            if (!db.objectStoreNames.contains('intents')) {
              const intentStore = db.createObjectStore('intents', { keyPath: 'id' });
              intentStore.createIndex('by-createdAt', 'createdAt');
            }
            if (!db.objectStoreNames.contains('templates')) {
              db.createObjectStore('templates', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('solutions')) {
              const solutionStore = db.createObjectStore('solutions', { keyPath: 'id' });
              solutionStore.createIndex('by-intentId', 'intentId');
              solutionStore.createIndex('by-createdAt', 'createdAt');
            }
          }
          // v2：为 Intent 补齐 recordVersion（keywordBundle 时代占位）
          if (oldVersion < 2 && transaction) {
            const store = transaction.objectStore('intents');
            let cursor = await store.openCursor();
            while (cursor) {
              const v = cursor.value as Intent;
              if (v.recordVersion == null) {
                await cursor.update({ ...v, recordVersion: 1 });
              }
              cursor = await cursor.continue();
            }
          }
        },
      });
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize IndexedDB, falling back to memory storage:', error);
      // 降级到内存存储，确保核心流程不中断
      this.db = null;
      this.initialized = true;
    }
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  // ========== Intent 相关方法 ==========

  async saveIntent(intent: Intent): Promise<void> {
    await this.ensureInit();

    const toSave = stampIntentForSave(intent);

    if (this.db) {
      try {
        await this.db.put('intents', toSave);
      } catch (error) {
        console.error('Failed to save intent to IndexedDB, using memory fallback:', error);
        this.memoryFallback.intents.set(toSave.id, toSave);
      }
    } else {
      this.memoryFallback.intents.set(toSave.id, toSave);
    }
  }

  async loadIntents(): Promise<Intent[]> {
    await this.ensureInit();

    if (this.db) {
      try {
        const list = await this.db.getAll('intents');
        return list.map((i) => normalizeIntent(i));
      } catch (error) {
        console.error('Failed to load intents from IndexedDB, using memory fallback:', error);
        return Array.from(this.memoryFallback.intents.values()).map((i) => normalizeIntent(i));
      }
    } else {
      return Array.from(this.memoryFallback.intents.values()).map((i) => normalizeIntent(i));
    }
  }

  async getIntent(id: string): Promise<Intent | null> {
    await this.ensureInit();

    if (this.db) {
      try {
        const row = await this.db.get('intents', id);
        return row ? normalizeIntent(row) : null;
      } catch (error) {
        console.error('Failed to get intent from IndexedDB, using memory fallback:', error);
        const row = this.memoryFallback.intents.get(id);
        return row ? normalizeIntent(row) : null;
      }
    } else {
      const row = this.memoryFallback.intents.get(id);
      return row ? normalizeIntent(row) : null;
    }
  }

  async deleteIntent(id: string): Promise<void> {
    await this.ensureInit();

    if (this.db) {
      try {
        await this.db.delete('intents', id);
      } catch (error) {
        console.error('Failed to delete intent from IndexedDB, using memory fallback:', error);
        this.memoryFallback.intents.delete(id);
      }
    } else {
      this.memoryFallback.intents.delete(id);
    }
  }

  // ========== Template 相关方法 ==========

  async saveTemplate(template: MetaTemplate): Promise<void> {
    await this.ensureInit();

    if (this.db) {
      try {
        await this.db.put('templates', template);
      } catch (error) {
        console.error('Failed to save template to IndexedDB, using memory fallback:', error);
        this.memoryFallback.templates.set(template.id, template);
      }
    } else {
      this.memoryFallback.templates.set(template.id, template);
    }
  }

  async loadTemplates(): Promise<MetaTemplate[]> {
    await this.ensureInit();

    if (this.db) {
      try {
        return await this.db.getAll('templates');
      } catch (error) {
        console.error('Failed to load templates from IndexedDB, using memory fallback:', error);
        return Array.from(this.memoryFallback.templates.values());
      }
    } else {
      return Array.from(this.memoryFallback.templates.values());
    }
  }

  async getTemplate(id: string): Promise<MetaTemplate | null> {
    await this.ensureInit();

    if (this.db) {
      try {
        return (await this.db.get('templates', id)) || null;
      } catch (error) {
        console.error('Failed to get template from IndexedDB, using memory fallback:', error);
        return this.memoryFallback.templates.get(id) || null;
      }
    } else {
      return this.memoryFallback.templates.get(id) || null;
    }
  }

  // ========== Solution 相关方法 ==========

  async saveSolution(solution: Solution): Promise<void> {
    await this.ensureInit();

    if (this.db) {
      try {
        await this.db.put('solutions', solution);
      } catch (error) {
        console.error('Failed to save solution to IndexedDB, using memory fallback:', error);
        this.memoryFallback.solutions.set(solution.id, solution);
      }
    } else {
      this.memoryFallback.solutions.set(solution.id, solution);
    }
  }

  async loadSolutions(): Promise<Solution[]> {
    await this.ensureInit();

    if (this.db) {
      try {
        return await this.db.getAll('solutions');
      } catch (error) {
        console.error('Failed to load solutions from IndexedDB, using memory fallback:', error);
        return Array.from(this.memoryFallback.solutions.values());
      }
    } else {
      return Array.from(this.memoryFallback.solutions.values());
    }
  }

  async getSolution(id: string): Promise<Solution | null> {
    await this.ensureInit();

    if (this.db) {
      try {
        return (await this.db.get('solutions', id)) || null;
      } catch (error) {
        console.error('Failed to get solution from IndexedDB, using memory fallback:', error);
        return this.memoryFallback.solutions.get(id) || null;
      }
    } else {
      return this.memoryFallback.solutions.get(id) || null;
    }
  }

  async deleteSolution(id: string): Promise<void> {
    await this.ensureInit();

    if (this.db) {
      try {
        await this.db.delete('solutions', id);
      } catch (error) {
        console.error('Failed to delete solution from IndexedDB, using memory fallback:', error);
        this.memoryFallback.solutions.delete(id);
      }
    } else {
      this.memoryFallback.solutions.delete(id);
    }
  }

  /**
   * 根据 Intent ID 获取关联的 Solutions
   */
  async getSolutionsByIntentId(intentId: string): Promise<Solution[]> {
    await this.ensureInit();

    if (this.db) {
      try {
        return await this.db.getAllFromIndex('solutions', 'by-intentId', intentId);
      } catch (error) {
        console.error('Failed to get solutions by intentId from IndexedDB, using memory fallback:', error);
        return Array.from(this.memoryFallback.solutions.values()).filter(
          s => s.intentId === intentId
        );
      }
    } else {
      return Array.from(this.memoryFallback.solutions.values()).filter(
        s => s.intentId === intentId
      );
    }
  }

  /**
   * 获取最近使用的模板（按最后使用时间排序）
   * 
   * 注意：需要在模板使用后更新 lastUsedAt 字段（Stage 1+ 实现）
   */
  async getRecentTemplates(limit: number = 10): Promise<MetaTemplate[]> {
    const templates = await this.loadTemplates();
    // Stage 0: 简单返回所有模板（Stage 1+ 实现按 lastUsedAt 排序）
    return templates.slice(0, limit);
  }
}

/**
 * 全局单例
 */
export const localDAO = new LocalDAO();
