import { FrameHop, MAX_LAYERS } from './drum-frame';
import { drumPoints, LAYER_RUN, Mushroom, VERSES } from './drum-patterns';

/**
 * A round of the mushroom drums as plain data, moved on by pure functions that take the time
 * (seconds on the game clock). The page calls `tick` many times a second and `answer` on a tap;
 * each returns the new state and the events to play, so the timing can be tested without a
 * browser, a clock or sound.
 *
 * With a beat, every mushroom is one bar: a question is asked on a downbeat and Pom lands on the
 * next one. An early right answer waits for the beat; a late one lands at once and the beat
 * starts again from there. A wrong answer holds the beat until the right one.
 */
export interface DrumPlay {
  readonly mushrooms: readonly Mushroom[];
  /** False in free play: no beat, Pom jumps as soon as the answer comes. */
  readonly timed: boolean;
  /** Seconds per beat; four beats make a bar, one bar per question. */
  readonly beat: number;
  /** How long after the landing beat an answer still counts as on the beat. */
  readonly grace: number;
  readonly phase: 'banner' | 'auto' | 'ask' | 'done';
  /** The mushroom Pom stands on, or jumps from. */
  readonly at: number;
  readonly hop: FrameHop | null;
  /** While a verse title shows, until this time; then Pom hops on. */
  readonly bannerUntil: number;
  /** When the current question was asked, and the beat Pom should land on. */
  readonly askedAt: number;
  readonly landing: number;
  /** Wrong taps on the current question. */
  readonly misses: number;
  /** The beat holds on a chord after a wrong answer. */
  readonly held: boolean;
  /** Past the landing beat without an answer: Pom waits on the edge. */
  readonly waiting: boolean;
  readonly stats: DrumStats;
}

export interface DrumStats {
  readonly points: number;
  /** Verse questions right on the first try: they make the stars. */
  readonly firstTry: number;
  readonly onBeat: number;
  /** Instrument layers playing, 1 to 5. */
  readonly layers: number;
  /** Good answers since the last layer change; four add an instrument. */
  readonly run: number;
  /** First-try answers in a row, and the longest such run. */
  readonly streak: number;
  readonly bestStreak: number;
  /** Counters for the scene: right answers (bursting when Pom lands) and wrong taps. */
  readonly hits: number;
  readonly bonks: number;
  /** Points from the last right answer, for the pop-up. */
  readonly gain: number;
}

export type DrumEvent =
  | { readonly kind: 'banner'; readonly verse: number; readonly from: number }
  | { readonly kind: 'hop'; readonly to: number; readonly land: number }
  | { readonly kind: 'land'; readonly index: number }
  | { readonly kind: 'ask'; readonly index: number }
  | {
      readonly kind: 'right';
      readonly index: number;
      readonly onBeat: boolean;
      readonly firstTry: boolean;
      readonly points: number;
    }
  | { readonly kind: 'wrong'; readonly index: number; readonly value: number }
  | { readonly kind: 'late'; readonly index: number }
  | { readonly kind: 'layer'; readonly layers: number; readonly up: boolean }
  | { readonly kind: 'regrid'; readonly origin: number }
  | { readonly kind: 'done' };

export interface Step {
  readonly play: DrumPlay;
  readonly events: readonly DrumEvent[];
}

/** Free play: how long a hop the band plays takes, and a verse title. */
const FREE_AUTO = 0.8;
const FREE_BANNER = 1.8;
const FREE_JUMP = 0.45;
/** The longest a jump arc takes with a beat; quick tempos jump in one beat. */
const MAX_JUMP = 0.6;

export function jumpSeconds(play: Pick<DrumPlay, 'timed' | 'beat'>) {
  return play.timed ? Math.min(play.beat, MAX_JUMP) : FREE_JUMP;
}

export function startPlay(
  mushrooms: readonly Mushroom[],
  options: { timed: boolean; beat: number; grace: number },
  now: number,
): Step {
  const play: DrumPlay = {
    mushrooms,
    ...options,
    phase: 'banner',
    at: 0,
    hop: null,
    bannerUntil: now + bannerSeconds(options),
    askedAt: now,
    landing: now,
    misses: 0,
    held: false,
    waiting: false,
    stats: {
      points: 0,
      firstTry: 0,
      onBeat: 0,
      layers: 1,
      run: 0,
      streak: 0,
      bestStreak: 0,
      hits: 0,
      bonks: 0,
      gain: 0,
    },
  };
  return {
    play,
    events: [
      { kind: 'regrid', origin: now },
      { kind: 'banner', verse: 0, from: now },
    ],
  };
}

function bannerSeconds(play: Pick<DrumPlay, 'timed' | 'beat'>) {
  return play.timed ? play.beat * 4 : FREE_BANNER;
}

/** The question Pom is facing, if he is facing one. */
export function asking(play: DrumPlay): number | null {
  return play.phase === 'ask' && !play.hop ? play.at + 1 : null;
}

/** Moves the round on to `now`: hops land, the next hop or question starts, Pom waits. */
export function tick(play: DrumPlay, now: number): Step {
  const events: DrumEvent[] = [];
  let state = play;
  // A slow device can miss a few beats; catch up step by step.
  for (let guard = 0; guard < 8; guard++) {
    const next = advance(state, now, events);
    if (next === state) break;
    state = next;
  }
  return { play: state, events };
}

function advance(play: DrumPlay, now: number, events: DrumEvent[]): DrumPlay {
  if (play.phase === 'done') return play;
  if (play.phase === 'banner') {
    if (now < play.bannerUntil) return play;
    return nextAfterLanding(play, play.bannerUntil, events, false);
  }
  if (play.hop) {
    if (now < play.hop.end) return play;
    const landed = play.hop.to;
    const end = play.hop.end;
    events.push({ kind: 'land', index: landed });
    return nextAfterLanding({ ...play, at: landed, hop: null }, end, events);
  }
  if (play.phase === 'ask' && play.timed && !play.held && !play.waiting && now > play.landing) {
    events.push({ kind: 'late', index: play.at + 1 });
    return { ...play, waiting: true };
  }
  return play;
}

/** Pom has just landed (or a title ended) at `time`: start whatever comes next. */
function nextAfterLanding(
  play: DrumPlay,
  time: number,
  events: DrumEvent[],
  titled = true,
): DrumPlay {
  const next = play.mushrooms[play.at + 1];
  if (!next) {
    events.push({ kind: 'done' });
    return { ...play, phase: 'done' };
  }
  const current = play.mushrooms[play.at];
  // A new verse or the solo opens with its title and a count-in.
  if (titled && next.verse !== current.verse) {
    events.push({ kind: 'banner', verse: next.verse, from: time });
    return { ...play, phase: 'banner', bannerUntil: time + bannerSeconds(play) };
  }
  if (next.given) {
    // The band plays this one: two beats a hop, landing on the beat.
    const length = play.timed ? play.beat * 2 : FREE_AUTO;
    const end = time + length;
    const hop = { from: play.at, to: play.at + 1, start: end - jumpSeconds(play), end };
    events.push({ kind: 'hop', to: hop.to, land: end });
    return { ...play, phase: 'auto', hop };
  }
  events.push({ kind: 'ask', index: play.at + 1 });
  return {
    ...play,
    phase: 'ask',
    askedAt: time,
    landing: time + play.beat * 4,
    misses: 0,
    held: false,
    waiting: false,
  };
}

/** The child taps `value` at `now`. Taps outside a question are ignored. */
export function answer(play: DrumPlay, value: number, now: number): Step {
  const index = asking(play);
  if (index === null) return { play, events: [] };
  const mushroom = play.mushrooms[index];
  const events: DrumEvent[] = [];
  const stats = play.stats;
  if (value !== mushroom.value) {
    events.push({ kind: 'wrong', index, value });
    // Only the first miss on a mushroom costs an instrument.
    const layers = play.misses === 0 ? Math.max(1, stats.layers - 1) : stats.layers;
    if (layers !== stats.layers) events.push({ kind: 'layer', layers, up: false });
    return {
      play: {
        ...play,
        misses: play.misses + 1,
        held: play.timed,
        waiting: false,
        stats: { ...stats, layers, run: 0, streak: 0, bonks: stats.bonks + 1 },
      },
      events,
    };
  }
  const firstTry = play.misses === 0;
  const onBeat = play.timed && firstTry && now <= play.landing + play.grace;
  const solo = mushroom.verse === VERSES;
  const points = drumPoints({ firstTry, onBeat, solo });
  let { layers, run } = stats;
  const good = firstTry && (onBeat || !play.timed);
  if (good) {
    run += 1;
    if (run >= LAYER_RUN && layers < MAX_LAYERS) {
      layers += 1;
      run = 0;
      events.push({ kind: 'layer', layers, up: true });
    }
  } else if (firstTry) {
    // Right but late: the song carries on with one instrument less.
    run = 0;
    if (layers > 1) {
      layers -= 1;
      events.push({ kind: 'layer', layers, up: false });
    }
  }
  const streak = firstTry ? stats.streak + 1 : 0;
  // On the beat, Pom lands on the landing beat; otherwise he jumps straight away.
  const jump = jumpSeconds(play);
  const end = onBeat && now < play.landing ? play.landing : now + jump;
  const hop = { from: play.at, to: index, start: Math.max(now, end - jump), end };
  if (!onBeat && play.timed) events.push({ kind: 'regrid', origin: end });
  events.push({ kind: 'right', index, onBeat, firstTry, points });
  events.push({ kind: 'hop', to: index, land: end });
  return {
    play: {
      ...play,
      hop,
      held: false,
      waiting: false,
      stats: {
        ...stats,
        points: stats.points + points,
        firstTry: stats.firstTry + (firstTry && !solo ? 1 : 0),
        onBeat: stats.onBeat + (onBeat ? 1 : 0),
        layers,
        run,
        streak,
        bestStreak: Math.max(stats.bestStreak, streak),
        // Raised with the hop: the scene plays the burst when Pom lands.
        hits: stats.hits + 1,
        gain: points,
      },
    },
    events,
  };
}

/**
 * Skips a verse title, or the hops Pom shows by himself at the start of a verse, straight to the
 * first question. Calls are the verse itself and are not skipped.
 */
export function skip(play: DrumPlay, now: number): Step {
  if (play.phase !== 'banner' && play.phase !== 'auto') return { play, events: [] };
  let at = play.hop ? play.hop.to : play.at;
  const verse = play.mushrooms[Math.min(at + 1, play.mushrooms.length - 1)].verse;
  const isCall = (index: number) => play.mushrooms[index]?.verse === 2;
  if (play.phase === 'auto' && isCall(at + 1)) return { play, events: [] };
  const events: DrumEvent[] = [];
  if (!isCall(at + 1)) {
    // Run along the given mushrooms of this verse to the one before its first question.
    while (play.mushrooms[at + 1]?.given && play.mushrooms[at + 1].verse === verse) at += 1;
  }
  events.push({ kind: 'regrid', origin: now });
  const moved = { ...play, at, hop: null };
  return { play: nextAfterLanding(moved, now, events, false), events };
}

/** Shifts every time in the round by `delta` seconds, after a pause. */
export function shift(play: DrumPlay, delta: number): DrumPlay {
  return {
    ...play,
    bannerUntil: play.bannerUntil + delta,
    askedAt: play.askedAt + delta,
    landing: play.landing + delta,
    hop: play.hop
      ? { ...play.hop, start: play.hop.start + delta, end: play.hop.end + delta }
      : null,
  };
}

/** The values Pom has landed on so far in verse `verse`, for the hundred chart. */
export function landedIn(play: DrumPlay, verse: number): number[] {
  return play.mushrooms
    .slice(0, play.at + 1)
    .filter((mushroom) => mushroom.verse === verse)
    .map((mushroom) => mushroom.value);
}
