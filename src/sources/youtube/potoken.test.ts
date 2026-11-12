import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getChallenge = vi.fn();
vi.mock("bgutils-js/botguard", () => ({ getChallenge, BotGuardClient: { create: vi.fn() } }));
vi.mock("bgutils-js/webpo", () => ({ WebPoMinter: { create: vi.fn() } }));
vi.mock("bgutils-js/utils", () => ({ buildURL: vi.fn(), getHeaders: vi.fn() }));
vi.mock("../../lib/http", () => ({ httpFetch: vi.fn() }));

describe("mintPoToken", () => {
  beforeEach(() => {
    vi.resetModules();
    getChallenge.mockReset().mockRejectedValue(new Error("no integrity token"));
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.useRealTimers());

  it("does not retry BotGuard on every track after it fails", async () => {
    const { mintPoToken } = await import("./potoken");
    await expect(mintPoToken("a")).rejects.toThrow();
    await expect(mintPoToken("b")).rejects.toThrow();
    await expect(mintPoToken("c")).rejects.toThrow();
    expect(getChallenge).toHaveBeenCalledTimes(1);
  });

  it("tries BotGuard again once the back-off has passed", async () => {
    const { mintPoToken } = await import("./potoken");
    await expect(mintPoToken("a")).rejects.toThrow();
    vi.advanceTimersByTime(16 * 60_000);
    await expect(mintPoToken("b")).rejects.toThrow();
    expect(getChallenge).toHaveBeenCalledTimes(2);
  });
});
