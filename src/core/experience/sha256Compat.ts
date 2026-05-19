/**
 * 兼容 SHA-256：优先用 WebCrypto（浏览器/部分 Node 环境），缺失时回退到 Node crypto。
 * 目的：让 Experience Store / 导出包在 vitest 下也可稳定跑通。
 */
export async function sha256HexOfUtf8TextCompat(input: string): Promise<string> {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (subtle) {
    const bytes = new TextEncoder().encode(input);
    const digest = await subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Node fallback（vitest / non-browser）
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

