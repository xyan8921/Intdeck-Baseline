import type { Scenario } from '@/core/ontology/types';
import type {
  IntentMetaSnapshot,
  IntentTopLevelCategory,
  IntentValueAttribution,
  IntentDataSovereignty,
} from '@/core/storage/types';
import { inferUserSideFromDescription } from './inferUserSide';

export interface RouteOptions {
  rawDescription?: string;
  params?: Record<string, unknown>;
}

/**
 * 与 `inferTopLevelAndSubCategory` 使用的描述串一致（供 E5 等扫描与路由分类对齐）。
 * 分类逻辑内部会 `.toLowerCase()`；本函数保留原文以便排斥性短语表匹配。
 */
export function getIntentRoutingInputText(
  scenario: Scenario,
  rawDescription?: string
): string {
  return `${scenario.scenario ?? ''} ${rawDescription ?? ''}`.trim();
}

function inferTopLevelAndSubCategory(
  scenario: Scenario,
  rawDescription?: string
): { topLevelCategory: IntentTopLevelCategory; subCategoryId: string } {
  const id = scenario.id;
  const desc = getIntentRoutingInputText(scenario, rawDescription).toLowerCase();

  // 1. 先根据自然语言关键词做粗分类（比 ID 优先）
  if (desc.includes('学术') || desc.includes('会议') || desc.includes('论坛') || desc.includes('峰会')) {
    return { topLevelCategory: 'Celebration', subCategoryId: 'corporate-anniversary' };
  }
  if (desc.includes('团建') || desc.includes('outing') || desc.includes('团体建设')) {
    return { topLevelCategory: 'Celebration', subCategoryId: 'team-bonding' };
  }
  if (desc.includes('露营') || desc.includes('camp')) {
    return { topLevelCategory: 'Celebration', subCategoryId: 'social-gathering' };
  }
  if (desc.includes('旅行') || desc.includes('出游') || desc.includes('旅游')) {
    return { topLevelCategory: 'ProblemSolving', subCategoryId: 'resource-allocation' };
  }
  if (
    desc.includes('学习') ||
    desc.includes('备考') ||
    desc.includes('考试') ||
    desc.includes('考研') ||
    desc.includes('study plan') ||
    desc.includes('study') ||
    desc.includes('exam prep') ||
    desc.includes('exam') ||
    desc.includes('ielts') ||
    desc.includes('toefl') ||
    desc.includes('sat') ||
    desc.includes('gmat') ||
    desc.includes('gre')
  ) {
    return { topLevelCategory: 'Learning', subCategoryId: 'academic-preparation' };
  }
  if (desc.includes('维修') || desc.includes('修理') || desc.includes('报修')) {
    return { topLevelCategory: 'ProblemSolving', subCategoryId: 'personal-life-admin' };
  }

  // 2. 再根据已知模板 ID 与场景描述匹配
  if (id === 'dinosaur-party' || id === 'event-planning') {
    return { topLevelCategory: 'Celebration', subCategoryId: 'social-gathering' };
  }
  if (id === 'recruitment') {
    return { topLevelCategory: 'Creation', subCategoryId: 'content-marketing' };
  }
  if (id === 'home-repair') {
    return { topLevelCategory: 'ProblemSolving', subCategoryId: 'personal-life-admin' };
  }
  if (id === 'travel-planning') {
    return { topLevelCategory: 'ProblemSolving', subCategoryId: 'resource-allocation' };
  }
  if (id === 'study-plan') {
    return { topLevelCategory: 'Learning', subCategoryId: 'academic-preparation' };
  }

  // 回退：根据场景描述里的关键词粗略推断
  if (
    desc.includes('学习') ||
    desc.includes('考试') ||
    desc.includes('学习计划') ||
    desc.includes('study') ||
    desc.includes('exam')
  ) {
    return { topLevelCategory: 'Learning', subCategoryId: 'academic-preparation' };
  }
  if (desc.includes('维修') || desc.includes('故障')) {
    return { topLevelCategory: 'ProblemSolving', subCategoryId: 'technical-troubleshooting' };
  }
  if (desc.includes('活动') || desc.includes('派对')) {
    return { topLevelCategory: 'Celebration', subCategoryId: 'social-gathering' };
  }

  // 默认：按 C/B 端简单归为 Creation/ProblemSolving
  if (scenario.category === 'B端') {
    return { topLevelCategory: 'Creation', subCategoryId: 'content-marketing' };
  }
  return { topLevelCategory: 'ProblemSolving', subCategoryId: 'personal-life-admin' };
}

function inferAttributionAndSovereignty(
  userSide: 'B端' | 'C端'
): { valueAttribution: IntentValueAttribution; dataSovereignty: IntentDataSovereignty } {
  if (userSide === 'B端') {
    return { valueAttribution: 'organization', dataSovereignty: 'org' };
  }
  return { valueAttribution: 'personal', dataSovereignty: 'user' };
}

export function routeIntent(
  scenario: Scenario,
  options: RouteOptions = {}
): IntentMetaSnapshot {
  const { topLevelCategory, subCategoryId } = inferTopLevelAndSubCategory(
    scenario,
    options.rawDescription
  );
  const inferred = options.rawDescription
    ? inferUserSideFromDescription(options.rawDescription)
    : null;
  /** R-01/R-03：自然语言强信号覆盖模板默认 B/C */
  const effectiveUserSide = inferred ?? scenario.category;
  const { valueAttribution, dataSovereignty } =
    inferAttributionAndSovereignty(effectiveUserSide);

  return {
    topLevelCategory,
    subCategoryId,
    userSide: effectiveUserSide,
    valueAttribution,
    dataSovereignty,
    riskLevel: 'low',
  };
}

/**
 * 基于自由文本与端属性（B/C）推断顶层类别与子类（无模板场景下的预览）
 */
export function routeFromFreeform(
  userSide: 'B端' | 'C端',
  rawDescription: string
): IntentMetaSnapshot {
  // 简单伪场景，便于复用现有推断规则
  const pseudoScenario: Scenario = {
    id: 'freeform',
    name: 'freeform',
    category: userSide,
    promptTemplate: '{{raw}}',
    workflowId: 'na',
    skills: [],
    ethicalPrinciples: ['E1', 'E3', 'E6'],
  };
  const { topLevelCategory, subCategoryId } = inferTopLevelAndSubCategory(
    pseudoScenario,
    rawDescription
  );
  const inferred = inferUserSideFromDescription(rawDescription);
  const effectiveUserSide = inferred ?? userSide;
  const { valueAttribution, dataSovereignty } =
    inferAttributionAndSovereignty(effectiveUserSide);

  return {
    topLevelCategory,
    subCategoryId,
    userSide: effectiveUserSide,
    valueAttribution,
    dataSovereignty,
    riskLevel: 'low',
  };
}

