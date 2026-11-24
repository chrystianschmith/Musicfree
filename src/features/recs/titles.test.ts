import { describe, expect, it } from "vitest";
import { isAltVersion, titleKey } from "./titles";

describe("titleKey", () => {
  it("treats versions of the same song as one key", () => {
    const k = titleKey("Evidências");
    expect(titleKey("Evidencias (Ao Vivo)")).toBe(k);
    expect(titleKey("EVIDÊNCIAS - Acústico")).toBe(k);
    expect(titleKey("Evidências [Official Video]")).toBe(k);
    expect(titleKey("Evidências feat. Fulano")).toBe(k);
    expect(titleKey("Evidências ft Fulano")).toBe(k);
    expect(titleKey("  evidências!! ")).toBe(k);
  });

  it("keeps different songs apart", () => {
    expect(titleKey("Yellow")).not.toBe(titleKey("Yellow Submarine"));
    expect(titleKey("Fix You")).not.toBe(titleKey("Fix"));
  });

  it("does not reduce a title to nothing", () => {
    expect(titleKey("(Intro)")).toBe("intro");
  });
});

describe("isAltVersion", () => {
  it.each([
    "Evidências (Cover)",
    "Yellow - Karaoke Version",
    "Fix You (Lyrics)",
    "Fix You - Letra",
    "Blinding Lights slowed + reverb",
    "Blinding Lights (Sped Up)",
    "Shape of You 8D Audio",
    "Numb (Nightcore)",
    "Clocks (Instrumental)",
    "Tribute to Coldplay - Yellow",
    "Yellow (In the Style of Coldplay)",
  ])("flags %s", (t) => expect(isAltVersion(t)).toBe(true));

  it.each(["Yellow", "Cover Me Up", "Discovery", "Letras Perdidas", "Clocks (Remastered 2023)"])(
    "keeps %s",
    (t) => expect(isAltVersion(t)).toBe(false),
  );
});
