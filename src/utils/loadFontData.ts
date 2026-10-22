import { readFile } from "node:fs/promises";
import path from "node:path";
import { experimental_getFontFileURL } from "astro:assets";

/**
 * Loads font data for OG image generation.
 *
 * Upstream AstroPaper fetches `experimental_getFontFileURL(fontPath, url)`
 * directly. That helper resolves to the prerender font server at
 * `http://[::]:<port>/...` (unspecified IPv6 address). Fetching `[::]` hangs
 * or fails in some sandboxed/CI networks, while the loopback `[::1]` works.
 * So: rewrite an unspecified host to loopback before fetching, and fall back
 * to reading the font from Astro's local font cache on disk if fetch fails.
 */
export async function loadFontData(
  fontPath: string,
  requestUrl: URL
): Promise<ArrayBuffer> {
  const fileUrl = experimental_getFontFileURL(fontPath, requestUrl);

  try {
    const url = new URL(fileUrl);
    if (url.hostname === "::" || url.hostname === "[::]") {
      url.hostname = "[::1]";
    }
    const res = await fetch(url);
    if (res.ok) return await res.arrayBuffer();
    throw new Error(`Font fetch failed: ${res.status}`);
  } catch {
    // Fallback: Astro caches downloaded fonts under its cache dir
    // (node_modules/.astro/fonts in builds, .astro/fonts in dev).
    const basename = path.basename(new URL(fontPath, requestUrl).pathname);
    const candidates = [
      path.join(process.cwd(), "node_modules", ".astro", "fonts", basename),
      path.join(process.cwd(), ".astro", "fonts", basename),
    ];
    for (const candidate of candidates) {
      try {
        const buf = await readFile(candidate);
        return buf.buffer.slice(
          buf.byteOffset,
          buf.byteOffset + buf.byteLength
        ) as ArrayBuffer;
      } catch {
        // try next candidate
      }
    }
    throw new Error(`Cannot load font data for ${fontPath}`);
  }
}
