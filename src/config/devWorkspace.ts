/**
 * 受监管开发工作区（路由恒为 `/dev/*`，与 C/B 前缀硬分离）。
 * Intdone 主系统**内部**默认称 **Dev 端**（本文件默认展示名）；对外/开源基线商品临时名 **Intdeck** 仅见工程文档，不替代此默认。
 */
const DEFAULT_DISPLAY_NAME = 'Dev 端';

function readDisplayName(): string {
  const raw = import.meta.env.VITE_DEV_WORKSPACE_NAME as string | undefined;
  const t = raw?.trim();
  if (t) return t;
  return DEFAULT_DISPLAY_NAME;
}

/**
 * UI 展示用名称（默认「Dev 端」）；专用构建可用 `VITE_DEV_WORKSPACE_NAME` 覆盖（仅文案，不改 `/dev` 路径）。
 */
export const devWorkspaceDisplayName = readDisplayName();

export const DEV_WORKSPACE_ROUTE_PREFIX = '/dev' as const;

/** 首页 Landing 顶栏与三卡入口：对外暂定名 + 内部 dev 标注（`/dev` 内仍以 `devWorkspaceDisplayName` 为主）。 */
export const devWorkspaceLandingEntryTitle = 'Intdeck（dev端）';

export const devWorkspaceHomeBackLabel = `← ${devWorkspaceDisplayName} 首页`;

export function isDevWorkspacePath(pathname: string): boolean {
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return p === DEV_WORKSPACE_ROUTE_PREFIX || p.startsWith(`${DEV_WORKSPACE_ROUTE_PREFIX}/`);
}
