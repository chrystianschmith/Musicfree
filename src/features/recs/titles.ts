/**
 * Title helpers that let recommendations recognise "the same song" across uploads:
 * live/acoustic versions, covers and re-uploads by other channels.
 */

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const collapse = (s: string) =>
  s
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

/** Normalised song name: no accents, decorations, "feat." credits or version suffixes. */
export function titleKey(title: string): string {
  const t = fold(title);
  const core = t
    .replace(/[([{][^)\]}]*[)\]}]/g, " ") // (Ao Vivo), [Official Video]
    .replace(/\s[-–—|]\s.*$/, " ") // " - Acústico", " | Clipe"
    .replace(/\s(?:feat|ft|featuring|part|with)\b\.?.*$/, " ");
  return collapse(core) || collapse(t);
}

/** Words that mark a non-original upload when they appear as a decoration of the title. */
const DECORATION =
  /\b(cover|covers|karaoke|lyrics?|lyric video|letra|legendado|traducao|instrumental|nightcore|sped up|slowed|reverb|8d|tribute|homenagem)\b/;
/** Markers that give an alternate version away wherever they are. */
const ANYWHERE =
  /\b(karaoke|nightcore|slowed|sped up|8d audio|in the style of|tribute to|homenagem a)\b/;

/** True for covers, karaoke, lyric re-uploads, slowed/sped-up edits and similar. */
export function isAltVersion(title: string): boolean {
  const t = fold(title);
  if (ANYWHERE.test(t)) return true;
  const decorations = [
    ...[...t.matchAll(/[([{]([^)\]}]*)[)\]}]/g)].map((m) => m[1]),
    ...[...t.matchAll(/\s[-–—|]\s(.*)$/g)].map((m) => m[1]),
  ];
  return decorations.some((d) => DECORATION.test(d));
}
