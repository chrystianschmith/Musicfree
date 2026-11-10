import { describe, expect, it } from "vitest";
import { BROWSER_UA, browserLikeHeaders } from "./http";

describe("browserLikeHeaders", () => {
  it("adds the target's own Origin and a browser User-Agent when missing", () => {
    const h = browserLikeHeaders("https://www.youtube.com/youtubei/v1/browse?x=1", {
      headers: { Accept: "*/*" },
    });
    expect(h.get("Origin")).toBe("https://www.youtube.com");
    expect(h.get("Referer")).toBe("https://www.youtube.com/");
    expect(h.get("User-Agent")).toBe(BROWSER_UA);
    expect(h.get("Accept")).toBe("*/*");
  });
  it("keeps headers the caller already set (client-specific user agents)", () => {
    const h = browserLikeHeaders(new URL("https://music.youtube.com/a"), {
      headers: new Headers({
        "User-Agent": "com.google.android.apps.youtube.vr.oculus/1.65.10",
        Origin: "https://x.test",
      }),
    });
    expect(h.get("User-Agent")).toBe("com.google.android.apps.youtube.vr.oculus/1.65.10");
    expect(h.get("Origin")).toBe("https://x.test");
  });
  it("reads the URL and headers from a Request object", () => {
    const h = browserLikeHeaders(
      new Request("https://lrclib.net/api/get", { headers: { "Lrclib-Client": "m" } }),
    );
    expect(h.get("Origin")).toBe("https://lrclib.net");
    expect(h.get("Lrclib-Client")).toBe("m");
  });
});
