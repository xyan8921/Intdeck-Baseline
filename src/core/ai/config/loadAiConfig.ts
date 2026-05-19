import type { AiTemplateConfig } from './types';
import defaultJson from './default.json';
import dinosaurJson from './templates/dinosaur-party.json';
import academicPreparationJson from './templates/academic-preparation.json';

const base = defaultJson as AiTemplateConfig;
const byId = new Map<string, AiTemplateConfig>([
  ['default', base],
  ['dinosaur-party', dinosaurJson as AiTemplateConfig],
  ['academic-preparation', academicPreparationJson as AiTemplateConfig],
]);
const bySubCategory = new Map<string, AiTemplateConfig>([
  ['academic-preparation', academicPreparationJson as AiTemplateConfig],
]);

export function getAiConfig(
  templateId: string | undefined,
  subCategoryId?: string
): AiTemplateConfig {
  if (templateId && byId.has(templateId)) {
    return byId.get(templateId)!;
  }
  if (subCategoryId && bySubCategory.has(subCategoryId)) {
    return bySubCategory.get(subCategoryId)!;
  }
  return base;
}
