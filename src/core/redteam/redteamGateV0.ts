/**
 * Red Team Gate v0 — 元数据与文档锚点（R2-b）。
 * 实际断言见 `redteamGate.v0.test.ts`；与 `INTDONE_INTDECK_THREAT_MODEL_WHITEPAPER_v0.md` §4（§4.2 T6、§4.3 R2-b）、`DEPLOYMENT.md`「R2-b」交叉引用。
 */
/** B2：纳入 T6（baseline allowlist / lockfile）后递增，便于与白皮书 §4.2 对账。 */
export const REDTEAM_GATE_V0_VERSION = '0.1' as const;

/** 仓库内单测入口（`npm run redteam:v0`） */
export const REDTEAM_GATE_V0_TEST_MODULE = 'src/core/redteam/redteamGate.v0.test.ts' as const;
