import { describe, expect, it } from "vitest";
import { formatTime, greeting, pickThumb } from "./format";

describe("formatTime", () => {
  it("formats seconds as m:ss", () => {
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(3725)).toBe("1:02:05");
  });
  it("returns a dash for invalid input", () => {
    expect(formatTime(NaN)).toBe("—");
    expect(formatTime(undefined)).toBe("—");
    expect(formatTime(-1)).toBe("—");
  });
});

describe("greeting", () => {
  it("depends on the hour", () => {
    expect(greeting(8)).toBe("Bom dia");
    expect(greeting(14)).toBe("Boa tarde");
    expect(greeting(20)).toBe("Boa noite");
    expect(greeting(2)).toBe("Boa noite");
  });
});

describe("pickThumb", () => {
  const thumbs = [
    { url: "s", w: 60, h: 60 },
    { url: "m", w: 226, h: 226 },
    { url: "l", w: 544, h: 544 },
  ];
  it("picks the smallest thumb at least as large as requested", () => {
    expect(pickThumb(thumbs, 200)).toBe("m");
    expect(pickThumb(thumbs, 40)).toBe("s");
  });
  it("falls back to the largest, or undefined when empty", () => {
    expect(pickThumb(thumbs, 1000)).toBe("l");
    expect(pickThumb([], 100)).toBeUndefined();
  });
});
