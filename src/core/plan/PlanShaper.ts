import type { Scenario } from '@/core/ontology/types';
import type { Deliverable } from '@/core/workflow/types';
import { resolveBudgetFromParams } from '@/core/money/resolveBudget';

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function applyBudgetForParty(content: string, budget: number): string {
  if (!content.includes('预算分配')) return content;
  const decor = Math.round(budget * 0.4);
  const food = Math.round(budget * 0.3);
  const props = budget - decor - food;

  return content
    .replace(/装饰：¥\d+/g, `装饰：¥${decor}`)
    .replace(/餐饮：¥\d+/g, `餐饮：¥${food}`)
    .replace(/活动道具：¥\d+/g, `活动道具：¥${props}`);
}

function applyTheme(content: string, theme: string | undefined): string {
  if (!theme) return content;
  if (!content.includes('恐龙') && !content.includes('恐龙主题')) return content;
  return content.replace(/恐龙/g, theme);
}

export function shapeDeliverable(
  scenario: Scenario,
  params: Record<string, unknown>,
  deliverable: Deliverable
): Deliverable {
  if (typeof deliverable.content !== 'string') {
    return deliverable;
  }

  let content = deliverable.content;

  const resolvedBudget = resolveBudgetFromParams(params);
  const budgetAmount =
    resolvedBudget?.effectiveAmount ?? toNumber(params.budget) ?? null;

  if (budgetAmount && (scenario.id === 'dinosaur-party' || scenario.id === 'event-planning')) {
    content = applyBudgetForParty(content, budgetAmount);
  } else if (budgetAmount && scenario.id === 'travel-planning') {
    content = applyBudgetForParty(content, budgetAmount);
  }

  if (resolvedBudget?.footnote) {
    content = `${content}\n\n---\n*${resolvedBudget.footnote}*`;
  }

  const theme = typeof params.theme === 'string' ? params.theme : undefined;
  if (theme) {
    content = applyTheme(content, theme);
  }

  return {
    ...deliverable,
    content,
  };
}

