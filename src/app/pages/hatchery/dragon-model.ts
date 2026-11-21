import { Group, Mesh, OctahedronGeometry } from 'three';
import type { Dragon } from './dragons';
import { buildBaby, buildGrand, buildYoung } from './dragon-forms';
import { DragonRig, paint, paints } from './dragon-parts';

export { RAINBOW } from './dragon-parts';

/**
 * A dragon built from soft shapes, in one of its three forms: the chubby hatchling, the lean
 * young dragon standing tall, and the four-legged final form. Each form has its own body and
 * shows its family more strongly. `update` animates breathing, blinking, wing beats and a
 * swaying tail; `cheer` makes it hop.
 */
export class DragonModel {
  readonly root = new Group();
  private readonly rig: DragonRig;
  private readonly sparkles: Mesh[] = [];
  /** A sleeping dragon keeps its eyes shut, for a nap after a lost duel. */
  sleeping = false;
  private cheerAt = -10;
  private blinkAt = 1.5;
  private readonly phase = Math.random() * 10;

  constructor(
    readonly dragon: Dragon,
    /** 0 the hatchling, 1 the young form, 2 the final form. */
    readonly stage = 0,
  ) {
    this.rig = {
      dragon,
      body: new Group(),
      head: new Group(),
      wings: [],
      tail: [],
      eyes: [],
      flames: [],
      flap: 'y',
    };
    this.root.add(this.rig.body);
    const colours = paints(dragon);
    const build = [buildBaby, buildYoung, buildGrand][stage] ?? buildBaby;
    const spots = build(this.rig, colours);

    if (dragon.starlight) {
      // Starlight dragons are sprinkled with tiny glowing stars.
      const glow = paint('#fff3b0', { emissive: '#ffe27a', emissiveIntensity: 0.9 });
      for (const [x, y, z] of spots) {
        const speck = new Mesh(new OctahedronGeometry(0.035), glow);
        speck.position.set(x, y, z);
        this.rig.body.add(speck);
        this.sparkles.push(speck);
      }
    }
  }

  /** A happy hop with a flap, for a hatch or a cheer. */
  cheer(now: number) {
    this.cheerAt = now;
  }

  /** `calm` holds the idle sway and breathing; hops and blinks stay. */
  update(now: number, blink = true, calm = false) {
    const { body, head, wings, tail, eyes, flames, flap } = this.rig;
    const t = now + this.phase;
    const since = now - this.cheerAt;
    const hop = since < 0.9 ? Math.sin((since / 0.9) * Math.PI) * 0.35 : 0;
    const flapping = since < 1.2;
    const flapSpeed = flapping ? 16 : 3.2;
    body.position.y = hop;
    const idle = calm ? 0 : 1;
    body.scale.set(1 + Math.sin(t * 2) * 0.012 * idle, 1 - Math.sin(t * 2) * 0.012 * idle, 1);
    for (const [index, hinge] of wings.entries()) {
      const side = index ? 1 : -1;
      const beat = Math.sin(t * flapSpeed) * (flapping ? 0.55 : 0.18 * idle);
      if (flap === 'y') {
        hinge.rotation.y = side * (0.25 + beat);
        hinge.rotation.z = side * -0.1;
      } else {
        hinge.rotation.z = side * (-0.15 + beat * 0.8);
      }
    }
    tail.forEach((segment, index) => {
      segment.rotation.y = Math.sin(t * 2.2 - index * 0.5) * 0.14 * idle;
    });
    head.rotation.z = Math.sin(t * 0.9) * 0.06 * idle;
    head.rotation.x = Math.sin(t * 0.7) * 0.04 * idle - (since < 0.9 ? 0.15 : 0);
    // Blink every few seconds.
    if (t > this.blinkAt + 0.14) this.blinkAt = t + 2.5 + ((t * 7.3) % 2.5);
    const closed = this.sleeping || (blink && t > this.blinkAt && t < this.blinkAt + 0.14);
    for (const eye of eyes) eye.scale.y = (closed ? 0.12 : 1) * eye.scale.x;
    for (const [index, flame] of flames.entries())
      flame.scale.setScalar(1 + Math.sin(t * 9 + index) * 0.12);
    for (const [index, speck] of this.sparkles.entries()) {
      speck.rotation.y = t * 2 + index;
      speck.scale.setScalar(0.7 + Math.abs(Math.sin(t * 2.5 + index)) * 0.6);
    }
  }
}
