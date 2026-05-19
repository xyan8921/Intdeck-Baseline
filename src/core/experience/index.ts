export {
  appendExperienceFromG0ActionReport,
  appendExperienceItem,
  buildExperienceExportPackage,
  downloadExperienceExportJson,
  loadExperienceItems,
} from './experienceStore';

export type {
  ExperienceExportPackageV1,
  ExperienceItemV1,
  IntdeckAgentConfigFileV1,
  IntdeckAgentRuntimeManifestV1,
} from './experienceTypes';

export { detectCapabilityDrift, hasCapabilityRegression } from './detectCapabilityDrift';
export type { CapabilityDriftEntry, CapabilityDriftSeverity } from './detectCapabilityDrift';

export { replayFromExperienceItem, REPLAY_MODULE, REPLAY_ACTION_TAG } from './replayFromExperienceItem';
export type { ReplayResult, ReplayOptions } from './replayFromExperienceItem';

