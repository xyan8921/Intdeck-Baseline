export type BackendContractMode = 'stub' | 'http';

export function resolveBackendContractMode(raw?: string): BackendContractMode {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'http') return 'http';
  return 'stub';
}

