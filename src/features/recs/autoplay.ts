import { getSource } from "../../sources";
import { usePlayer } from "../../store/player";

let pendingFor: string | undefined;

/**
 * Endless queue: when the current track is the last one (and repeat is off), fetch similar
 * tracks and append them so the music keeps going, like autoplay on Spotify.
 */
export async function extendQueueIfNeeded() {
  const s = usePlayer.getState();
  const cur = s.current();
  if (!cur || s.repeat !== "off" || s.upcoming().length > 0 || pendingFor === cur.id) return;
  pendingFor = cur.id;
  try {
    const radio = await getSource().radio(cur.id);
    usePlayer.getState().appendTracks(radio.slice(0, 25));
  } catch (e) {
    console.warn("[autoplay] could not extend the queue", e);
    pendingFor = undefined;
  }
}
