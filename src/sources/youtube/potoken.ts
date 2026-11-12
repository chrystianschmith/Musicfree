/**
 * Proof-of-Origin tokens. YouTube's media servers serve only the first ~1 MB of a stream
 * unless the URL carries a `pot` token minted by BotGuard, the attestation script YouTube's
 * own web player runs. The desktop app's webview is a real browser, so we run the same
 * script there (via bgutils-js) and mint tokens like youtube.com does.
 */
import { BotGuardClient, getChallenge } from "bgutils-js/botguard";
import { WebPoMinter } from "bgutils-js/webpo";
import { buildURL, getHeaders } from "bgutils-js/utils";
import { httpFetch } from "../../lib/http";

/** Public key YouTube's web player uses for BotGuard. */
const REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";

type Minter = { minter: WebPoMinter; expiresAt: number };
let current: Promise<Minter> | undefined;
/** After BotGuard fails, wait this long before trying again instead of retrying on every track. */
const RETRY_AFTER_MS = 15 * 60_000;
let failedAt = 0;
let lastError: unknown;

async function createMinter(): Promise<Minter> {
  const fetchFn = httpFetch as typeof fetch;
  const challenge = await getChallenge({
    requestKey: REQUEST_KEY,
    fetchFunction: fetchFn,
    useYouTubeAPI: true,
  });
  const script = challenge.interpreterJavascript?.privateDoNotAccessOrElseSafeScriptWrappedValue;
  if (!script || !challenge.program || !challenge.globalName)
    throw new Error("BotGuard challenge incomplete");
  new Function(script)();

  const client = await BotGuardClient.create({
    program: challenge.program,
    globalName: challenge.globalName,
    globalObject: globalThis,
  });
  const webPoSignalOutput: Parameters<typeof WebPoMinter.create>[1] = [];
  const botguardResponse = await client.snapshot({ webPoSignalOutput });

  const res = await fetchFn(buildURL("GenerateIT", true), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify([REQUEST_KEY, botguardResponse]),
  });
  if (!res.ok) throw new Error(`GenerateIT HTTP ${res.status}`);
  const [integrityToken, ttlSecs] = (await res.json()) as [string?, number?];
  if (!integrityToken) throw new Error("no integrity token");
  const minter = await WebPoMinter.create({ integrityToken }, webPoSignalOutput);
  return { minter, expiresAt: Date.now() + Math.max(300, (ttlSecs ?? 3600) - 300) * 1000 };
}

async function getMinter(): Promise<WebPoMinter> {
  if (!current && failedAt && Date.now() - failedAt < RETRY_AFTER_MS) throw lastError;
  if (current) {
    const m = await current.catch(() => undefined);
    if (m && m.expiresAt > Date.now()) return m.minter;
  }
  current = createMinter();
  current.then(
    () => (failedAt = 0),
    (e) => {
      console.error("[potoken] could not initialise BotGuard", e);
      current = undefined;
      failedAt = Date.now();
      lastError = e;
    },
  );
  return (await current).minter;
}

/** Mints a PO token bound to `identifier` (visitor data for the session, video id for a video). */
export async function mintPoToken(identifier: string): Promise<string> {
  return (await getMinter()).mintAsWebsafeString(identifier);
}
