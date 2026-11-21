/**
 * Kiki's reactions as plain numbers over time, so the 3D pond only has to apply them. Every
 * pose is a function of the seconds since the answer, which keeps the timing readable and
 * testable without a renderer.
 */
import { clamp01, easeOut, smooth } from '../../shared/three/motion';

export interface KikiPose {
  /** How far she has swum toward the pad: 0 at home, 1 at the pad, below 0 pulled back. */
  readonly lunge: number;
  /** 0 shut to 1 wide open; the wind-up opens a little past 1. */
  readonly jaw: number;
  /** Scale along her length: above 1 stretched out, below 1 squashed. */
  readonly length: number;
  /** Scale up and down. Her width follows from both, so her volume stays about the same. */
  readonly height: number;
  /** Nose up (positive) or down, in radians. */
  readonly pitch: number;
  /** 0 to 1: puffed cheeks while she chews. */
  readonly cheeks: number;
  /** 0 to 1: how far a swallowed bump has travelled from her head to her belly; -1 for none. */
  readonly gulp: number;
  /** 0 to 1: eyes closed in a happy smile. */
  readonly content: number;
  /** Height of a hop, in Kiki sizes. */
  readonly rise: number;
}

/** Seconds into a chomp when the jaws snap shut: the splash and the crunch land here. */
export const SNAP = 0.34;
/** When the wind-up ends and she strikes. */
const STRIKE = 0.2;
/** When the tiles leave their pad and when they reach her mouth. */
export const TILES_LEAVE = 0.17;
export const TILES_ARRIVE = 0.33;

export const REST: KikiPose = {
  lunge: 0,
  jaw: 0,
  length: 1,
  height: 1,
  pitch: 0,
  cheeks: 0,
  gulp: -1,
  content: 0,
  rise: 0,
};

/** Keeps her volume: a longer Kiki is a thinner Kiki. */
const heightFor = (length: number) => 1 / Math.sqrt(length);

/** Her width for a pose: whatever keeps her volume. */
export const widthOf = (pose: KikiPose) => 1 / (pose.length * pose.height);

/** A spring that rings once or twice and settles: 1 at `age` 0, then 0. */
const ring = (age: number, frequency: number, decay: number) =>
  age < 0 ? 0 : Math.cos(age * frequency) * Math.exp(-age * decay);

/**
 * A chomp at a pad: she rears back with her jaws wide (anticipation), strikes forward stretched
 * out, snaps shut and squashes on the bite, chews with puffed cheeks, swallows (a bump runs down
 * her body) and swims home with her eyes closed, content.
 */
export function chompPose(age: number): KikiPose {
  if (age < 0) return REST;
  let lunge: number;
  let jaw: number;
  let length: number;
  let pitch: number;
  if (age < STRIKE) {
    // Wind-up: pull back, nose up, jaws open past wide.
    const w = smooth(age / STRIKE);
    lunge = -0.14 * w;
    jaw = 1.15 * w;
    length = 1 - 0.12 * w;
    pitch = 0.22 * w;
  } else if (age < SNAP) {
    // Strike: shoot forward, stretched long; the jaws hold wide, then slam.
    const s = (age - STRIKE) / (SNAP - STRIKE);
    lunge = -0.14 + 1.14 * easeOut(s * 1.15);
    jaw = s < 0.7 ? 1.15 - 0.1 * s : 1.08 * (1 - smooth((s - 0.7) / 0.3));
    // Unsquashes out of the wind-up as she stretches into the strike.
    length = 1 - 0.12 * (1 - smooth(s * 2.5)) + 0.22 * Math.sin(Math.min(1, s * 1.1) * Math.PI);
    pitch = 0.22 - 0.36 * smooth(s);
  } else {
    // The bite lands: squash along her length, then a springy recovery.
    const after = age - SNAP;
    lunge = after < 0.5 ? 1 : 1 - smooth((after - 0.5) / 0.5);
    // The squash lands over a couple of frames rather than in one jump.
    length = 1 - 0.16 * (after < 0.04 ? smooth(after / 0.04) : ring(after - 0.04, 22, 7));
    pitch = -0.14 * Math.exp(-after * 8) + 0.05 * Math.sin(clamp01((after - 0.5) / 0.5) * Math.PI);
    // Two chews, then shut.
    jaw = after > 0.1 && after < 0.6 ? Math.max(0, Math.sin((after - 0.1) * 4 * Math.PI)) * 0.2 : 0;
  }
  const after = age - SNAP;
  const cheeks = after < 0 ? 0 : Math.sin(clamp01(after / 0.7) * Math.PI) ** 0.6;
  const gulp = after < 0.45 ? -1 : after > 0.95 ? -1 : (after - 0.45) / 0.5;
  const content = after < 0.55 ? 0 : after < 1.0 ? smooth((after - 0.55) / 0.15) : 1;
  return {
    lunge,
    jaw,
    length,
    height: heightFor(length),
    pitch,
    cheeks,
    gulp,
    content,
    rise: 0,
  };
}

/**
 * Both sides the same: she stays put with her mouth shut, crouches, hops for joy (stretched
 * tall on the way up), lands with a squash and a splash, and beams.
 */
export function hopPose(age: number): KikiPose {
  if (age < 0) return REST;
  const crouch = 0.14;
  const air = 0.42;
  let length = 1;
  let height = 1;
  let rise = 0;
  let pitch = 0;
  if (age < crouch) {
    const c = smooth(age / crouch);
    height = 1 - 0.18 * c;
  } else if (age < crouch + air) {
    const a = (age - crouch) / air;
    rise = Math.sin(a * Math.PI) * 0.5;
    height = 1 + 0.14 * Math.cos(a * Math.PI);
    pitch = 0.28 * Math.cos(a * Math.PI);
  } else {
    const after = age - crouch - air;
    height = 1 - 0.16 * ring(after, 20, 6);
  }
  // The hop stretches her up; length and width share the difference.
  length = 1 / Math.sqrt(height);
  return {
    lunge: 0,
    jaw: 0,
    length,
    height,
    pitch,
    cheeks: 0,
    gulp: -1,
    content: age < crouch ? 0 : smooth((age - crouch) / 0.2),
    rise,
  };
}

/**
 * A wrong pick, kind but clear: she flinches back from the side she was offered with her mouth
 * shut tight, gives a small shrug (squashes down and back up) and shakes her head. The head shake
 * itself is `refuseShake`, since it turns her and the pose does not.
 */
export function refusePose(age: number, duration: number): KikiPose {
  if (age < 0 || age > duration) return REST;
  const back = Math.sin(clamp01(age / 0.35) * Math.PI * 0.5) * (1 - smooth((age - 0.5) / 0.5));
  const shrug = Math.sin(clamp01(age / 0.4) * Math.PI);
  const height = 1 - 0.1 * shrug;
  return {
    lunge: -0.12 * back,
    jaw: 0,
    length: 1 / Math.sqrt(height),
    height,
    pitch: 0.12 * back,
    cheeks: 0,
    gulp: -1,
    content: 0,
    rise: 0,
  };
}

/** Her head shake after a wrong pick, in radians: quick, then dying away. */
export function refuseShake(age: number, duration: number): number {
  if (age < 0.08 || age > duration) return 0;
  const a = age - 0.08;
  return Math.sin(a * 20) * 0.42 * (1 - smooth(a / (duration - 0.08)));
}

/**
 * Where the eaten tiles are on their hop into Kiki's mouth: 0 still on the pad, 1 inside. `arc`
 * is how high above the straight line they are, as a share of the jump's length.
 */
export function tileHop(age: number): { readonly along: number; readonly arc: number } {
  const s = clamp01((age - TILES_LEAVE) / (TILES_ARRIVE - TILES_LEAVE));
  return { along: s * s * (3 - 2 * s), arc: Math.sin(s * Math.PI) * 0.35 };
}
