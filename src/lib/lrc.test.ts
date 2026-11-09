import { describe, expect, it } from "vitest";
import { activeLine, parseLrc } from "./lrc";

describe("parseLrc", () => {
  it("parses timestamps into seconds", () => {
    expect(parseLrc("[00:01.50]Olá\n[01:02.00]Mundo")).toEqual([
      { t: 1.5, line: "Olá" },
      { t: 62, line: "Mundo" },
    ]);
  });
  it("ignores metadata tags and sorts out-of-order lines", () => {
    const lrc = "[ar:Artista]\n[length: 03:20]\n[00:10.00]B\n[00:05.00]A\n\n[00:20]C";
    expect(parseLrc(lrc).map((l) => l.line)).toEqual(["A", "B", "C"]);
  });
  it("expands lines with several timestamps and keeps empty instrumental lines", () => {
    expect(parseLrc("[00:01.00][00:03.00]Refrão\n[00:02.00]")).toEqual([
      { t: 1, line: "Refrão" },
      { t: 2, line: "" },
      { t: 3, line: "Refrão" },
    ]);
  });
  it("accepts 3-digit fractions and returns [] for plain text", () => {
    expect(parseLrc("[00:01.250]x")[0].t).toBeCloseTo(1.25);
    expect(parseLrc("sem tempo")).toEqual([]);
  });
});

describe("activeLine", () => {
  const lines = [
    { t: 1, line: "a" },
    { t: 5, line: "b" },
    { t: 9, line: "c" },
  ];
  it("returns -1 before the first line", () => expect(activeLine(lines, 0.5)).toBe(-1));
  it("returns the last line whose time has passed", () => {
    expect(activeLine(lines, 1)).toBe(0);
    expect(activeLine(lines, 7)).toBe(1);
    expect(activeLine(lines, 100)).toBe(2);
  });
});
