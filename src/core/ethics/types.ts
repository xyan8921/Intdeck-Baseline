import type { EthicsDecision } from '../ai/types';

export interface EthicsInput {
  subject: {
    type: 'output_text' | 'plan' | 'action';
    skillId?: string;
    label?: string;
  };
  meta: unknown;
  candidate: unknown;
}

export interface EthicsGuard {
  checkCandidate(input: EthicsInput): Promise<EthicsDecision>;
  logEvent?(event: unknown): Promise<void>;
}


