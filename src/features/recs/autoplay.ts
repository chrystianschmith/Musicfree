import { usePlayer } from "../../store/player";
import { recommender } from "./engine";

let pendingFor: string | undefined;

/**
 * Endless queue: when the current track is the last one (and repeat is off), append tracks
 * of the same style (album, artist, similar artists) so the music keeps going.
 */
export async function extendQueueIfNeeded() {
  const s = usePlayer.getState();
  const cur = s.current();
  if (!cur || s.repeat !== "off" || s.upcoming().length > 0 || pendingFor === cur.id) return;
  pendingFor = cur.id;
  try {
    const next = await recommender().recommendFor([cur], {
      limit: 25,
      heard: s.queue,
      maxPerArtist: 5,
    });
    usePlayer.getState().appendTracks(next);
  } catch (e) {
    console.warn("[autoplay] could not extend the queue", e);
    pendingFor = undefined;
  }
}
