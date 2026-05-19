import { describe, expect, it } from 'vitest';
import { buildPersonalSpendingObservations } from './spending';
import type { Intent, Solution } from '../storage/types';

describe('buildPersonalSpendingObservations', () => {
  it('keeps C-side personal entries only', () => {
    const now = new Date();
    const intents: Intent[] = [
      {
        id: 'c1',
        content: '个人购物',
        category: 'C端',
        meta: {
          topLevelCategory: 'ProblemSolving',
          subCategoryId: 'personal-life-admin',
          userSide: 'C端',
          valueAttribution: 'personal',
          dataSovereignty: 'user',
          budget: 100,
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'b1',
        content: '公司采购',
        category: 'B端',
        meta: {
          topLevelCategory: 'ProblemSolving',
          subCategoryId: 'generic',
          userSide: 'B端',
          valueAttribution: 'organization',
          dataSovereignty: 'org',
          budget: 200,
        },
        createdAt: now,
        updatedAt: now,
      },
    ];
    const solutions: Solution[] = [];
    const rows = buildPersonalSpendingObservations(intents, solutions);
    expect(rows).toHaveLength(1);
    expect(rows[0].intentId).toBe('c1');
    expect(rows[0].valueAttribution).toBe('personal');
    expect(rows[0].userSide).toBe('C端');
  });
});

