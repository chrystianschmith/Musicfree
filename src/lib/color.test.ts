import { describe, expect, it } from "vitest";
import { ambientFromPixels, toCss } from "./color";

const px = (...rgb: number[][]) =>
  new Uint8ClampedArray(rgb.flatMap(([r, g, b, a = 255]) => [r, g, b, a]));

describe("ambientFromPixels", () => {
  it("prefers the vivid colour over greys and near-black", () => {
    const [r, g, b] = ambientFromPixels(
      px([10, 10, 10], [128, 128, 128], [60, 52, 137], [60, 52, 137], [240, 240, 240]),
    )!;
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });
  it("ignores transparent pixels and returns null when nothing is usable", () => {
    expect(ambientFromPixels(px([255, 0, 0, 0]))).toBeNull();
    expect(ambientFromPixels(new Uint8ClampedArray())).toBeNull();
  });
  it("falls back to a muted average for monochrome covers", () => {
    const c = ambientFromPixels(px([200, 200, 200], [180, 180, 180]))!;
    expect(Math.max(...c) - Math.min(...c)).toBeLessThan(10);
    expect(Math.max(...c)).toBeLessThanOrEqual(120); // toned down so text stays readable
  });
  it("keeps the result dark enough for white text", () => {
    const c = ambientFromPixels(px([255, 230, 0], [255, 230, 0]))!;
    expect(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]).toBeLessThanOrEqual(130);
  });
});

describe("toCss", () => {
  it("formats rgb", () => expect(toCss([1, 2, 3])).toBe("rgb(1 2 3)"));
});
