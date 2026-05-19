import { describe, expect, it } from 'vitest';
import type { Scenario } from '@/core/ontology/types';
import { getIntentRoutingInputText, routeFromFreeform } from './IntentRouter';

describe('routeFromFreeform', () => {
  it('should infer B-side and academic meeting subcategory', () => {
    const meta = routeFromFreeform('C端', '我们公司要办一场学术会议并做会务筹备');
    expect(meta.userSide).toBe('B端');
    expect(meta.topLevelCategory).toBe('Celebration');
    expect(meta.subCategoryId).toBe('corporate-anniversary');
  });

  it('should infer B-side for forum with sponsors', () => {
    const meta = routeFromFreeform(
      'C端',
      '我们要办一场技术论坛，预计200人，包含赞助商展位与现场签到'
    );
    expect(meta.userSide).toBe('B端');
  });

  it('should infer B-side for corporate annual meeting', () => {
    const meta = routeFromFreeform('C端', '公司年会策划，预计300人，需要供应商比价与物料清单');
    expect(meta.userSide).toBe('B端');
  });

  it('should infer B-side for community market event', () => {
    const meta = routeFromFreeform('C端', '园区要举办社区市集活动，需要摊位招商与现场秩序安排');
    expect(meta.userSide).toBe('B端');
  });

  it('should keep learning category for study intent', () => {
    const meta = routeFromFreeform('C端', '我想做一个雅思备考学习计划');
    expect(meta.userSide).toBe('C端');
    expect(meta.topLevelCategory).toBe('Learning');
    expect(meta.subCategoryId).toBe('academic-preparation');
  });

  it('resolves B/C conflict: org signals win when present', () => {
    const meta = routeFromFreeform('C端', '我个人也想学，但我们公司要办一场技术论坛，包含赞助商展位');
    expect(meta.userSide).toBe('B端');
  });

  it('resolves B/C conflict: explicit personal qualifier can keep C-side', () => {
    const meta = routeFromFreeform('B端', '这是我个人的论坛学习笔记整理，不涉及公司或组织活动');
    expect(meta.userSide).toBe('C端');
  });
});

describe('getIntentRoutingInputText', () => {
  it('matches inferTopLevelAndSubCategory input (scenario + raw)', () => {
    const s = {
      id: 't',
      name: 'n',
      category: 'C端' as const,
      promptTemplate: '',
      workflowId: 'w',
      skills: [] as string[],
      ethicalPrinciples: ['E1'] as ('E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6')[],
      scenario: '活动策划',
    } satisfies Scenario;
    expect(getIntentRoutingInputText(s, '预算五千')).toBe('活动策划 预算五千');
    expect(getIntentRoutingInputText(s, undefined)).toBe('活动策划');
  });
});

