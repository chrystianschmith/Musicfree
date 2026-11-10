export type RGB = [number, number, number];

const luma = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const MAX_LUMA = 130;

/**
 * Picks an ambient colour from RGBA pixel data: the saturation-weighted average, so a vivid
 * accent wins over greys; monochrome art yields a muted grey. The result is capped in
 * brightness so light text on top stays readable.
 */
export function ambientFromPixels(data: Uint8ClampedArray): RGB | null {
  let wr = 0,
    wg = 0,
    wb = 0,
    wsum = 0;
  let ar = 0,
    ag = 0,
    ab = 0,
    n = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    if (data[i + 3] < 128) continue;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const w = sat * sat * (max / 255);
    wr += r * w;
    wg += g * w;
    wb += b * w;
    wsum += w;
    ar += r;
    ag += g;
    ab += b;
    n++;
  }
  if (!n) return null;
  let c: RGB = wsum > n * 0.01 ? [wr / wsum, wg / wsum, wb / wsum] : [ar / n, ag / n, ab / n];
  const cap = wsum > n * 0.01 ? MAX_LUMA : 110;
  const l = luma(c);
  if (l > cap) c = c.map((v) => (v * cap) / l) as RGB;
  return c.map((v) => Math.floor(v)) as RGB;
}

export const toCss = ([r, g, b]: RGB) => `rgb(${r} ${g} ${b})`;

const cache = new Map<string, Promise<RGB | null>>();

/** Ambient colour of an image URL (cached). Resolves null when the image can't be read. */
export function ambientOf(url: string): Promise<RGB | null> {
  let p = cache.get(url);
  if (!p) {
    p = new Promise<RGB | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = c.height = 24;
          const ctx = c.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(img, 0, 0, 24, 24);
          resolve(ambientFromPixels(ctx.getImageData(0, 0, 24, 24).data));
        } catch {
          resolve(null); // tainted canvas (no CORS headers)
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
    cache.set(url, p);
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
  }
  return p;
}
