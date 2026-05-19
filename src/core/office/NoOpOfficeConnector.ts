import type { OfficeCapability, OfficeConnector } from './types';

/** 默认空实现：占位，避免业务层直接依赖具体厂商 SDK */
export class NoOpOfficeConnector implements OfficeConnector {
  readonly id = 'noop';
  readonly capabilities = new Set<OfficeCapability>([]);
}
