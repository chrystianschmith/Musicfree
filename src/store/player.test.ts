import { beforeEach, describe, expect, it } from "vitest";
import type { Track } from "../sources/types";
import { usePlayer } from "./player";

const t = (n: number): Track => ({
  id: `t${n}`,
  title: `Track ${n}`,
  artists: [{ name: "A" }],
  thumbs: [],
});
const five = [1, 2, 3, 4, 5].map(t);
const s = () => usePlayer.getState();

beforeEach(() => usePlayer.getState().reset());

describe("player store", () => {
  it("does nothing on next/prev/toggle with an empty queue", () => {
    expect(() => {
      s().next();
      s().prev();
      s().toggle();
    }).not.toThrow();
    expect(s().current()).toBeUndefined();
    expect(s().playing).toBe(false);
  });

  it("plays tracks from a start index", () => {
    s().playTracks(five, 2);
    expect(s().current()?.id).toBe("t3");
    expect(s().playing).toBe(true);
  });

  it("advances and stops at the end when repeat is off", () => {
    s().playTracks(five, 4);
    s().onEnded();
    expect(s().current()?.id).toBe("t5");
    expect(s().playing).toBe(false);
  });

  it("wraps to the first track with repeat all", () => {
    s().playTracks(five, 4);
    s().cycleRepeat(); // off -> all
    s().onEnded();
    expect(s().current()?.id).toBe("t1");
    expect(s().playing).toBe(true);
  });

  it("repeats the same track on end with repeat one, but next() still advances", () => {
    s().playTracks(five, 1);
    s().cycleRepeat();
    s().cycleRepeat(); // all -> one
    expect(s().repeat).toBe("one");
    s().onEnded();
    expect(s().current()?.id).toBe("t2");
    expect(s().seekRequest).toBe(0);
    s().next();
    expect(s().current()?.id).toBe("t3");
  });

  it("prev restarts the current track after 3 seconds", () => {
    s().playTracks(five, 2);
    s().setPosition(12);
    s().prev();
    expect(s().current()?.id).toBe("t3");
    expect(s().seekRequest).toBe(0);
  });

  it("prev goes to the previous track within the first 3 seconds", () => {
    s().playTracks(five, 2);
    s().setPosition(1);
    s().prev();
    expect(s().current()?.id).toBe("t2");
  });

  it("keeps the current track when shuffling and restores order when unshuffling", () => {
    s().playTracks(five, 2);
    s().setShuffle(true);
    expect(s().current()?.id).toBe("t3");
    expect(s().order[0]).toBe(2);
    expect([...s().order].sort()).toEqual([0, 1, 2, 3, 4]);
    s().next();
    s().setShuffle(false);
    const cur = s().current()!.id;
    expect(
      s()
        .upcoming()
        .map((x) => x.id),
    ).toEqual(five.slice(five.findIndex((x) => x.id === cur) + 1).map((x) => x.id));
  });

  it("playNext inserts right after the current track", () => {
    s().playTracks(five, 0);
    s().playNext(t(9));
    expect(s().upcoming()[0].id).toBe("t9");
  });

  it("addToQueue appends to the end; on empty queue it starts playing", () => {
    s().addToQueue(t(7));
    expect(s().current()?.id).toBe("t7");
    s().addToQueue(t(8));
    expect(
      s()
        .upcoming()
        .map((x) => x.id),
    ).toEqual(["t8"]);
  });

  it("removes and moves upcoming items", () => {
    s().playTracks(five, 0);
    s().removeUpcoming(0); // removes t2
    expect(
      s()
        .upcoming()
        .map((x) => x.id),
    ).toEqual(["t3", "t4", "t5"]);
    s().moveUpcoming(2, 0); // t5 to front
    expect(
      s()
        .upcoming()
        .map((x) => x.id),
    ).toEqual(["t5", "t3", "t4"]);
    expect(s().current()?.id).toBe("t1");
  });

  it("clamps volume between 0 and 1", () => {
    s().setVolume(2);
    expect(s().volume).toBe(1);
    s().setVolume(-1);
    expect(s().volume).toBe(0);
  });
});

describe("appendTracks (endless queue)", () => {
  it("appends only tracks not already queued and keeps the current one", () => {
    s().playTracks(five, 4);
    s().appendTracks([t(5), t(6), t(7), t(6)]);
    expect(s().current()?.id).toBe("t5");
    expect(
      s()
        .upcoming()
        .map((x) => x.id),
    ).toEqual(["t6", "t7"]);
  });
  it("shuffled queues receive the new tracks at the end of the order", () => {
    s().playTracks(five, 0);
    s().setShuffle(true);
    s().appendTracks([t(8)]);
    expect(s().upcoming().at(-1)?.id).toBe("t8");
  });
  it("starts playback when the queue is empty", () => {
    s().appendTracks([t(1), t(2)]);
    expect(s().current()?.id).toBe("t1");
  });
});
