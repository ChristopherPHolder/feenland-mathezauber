import {
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PCFSoftShadowMap,
  SphereGeometry,
  Sprite as Billboard,
  SpriteMaterial,
  Vector3,
} from 'three';
import { easeOut, EventCounter } from '../../shared/three/motion';
import { TextLabel } from '../../shared/three/labels';
import { disposeTree, Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { DragonModel } from '../hatchery/dragon-model';
import type { DragonElement } from '../hatchery/dragons';
import type { ArenaFrame, DuelSky } from './duel-frame';
import { ATTACK_COLORS } from './duel-looks';
import { ball, paint, SpriteModel, spriteScale } from './duel-models';

export const DRAGON_AT = new Vector3(-1.25, 0, 0.15);
export const SPRITE_AT = new Vector3(1.3, 0, 0);
/** Each form stands a little taller, so later forms are shown a little smaller. */
export const FORM_SCALE = [0.95, 0.8, 0.66];
const FLIGHT = 0.5;

const SKIES: Readonly<
  Record<DuelSky, { sky: string; ground: string; light: number; grass: string; sun: number }>
> = {
  day: { sky: '#fff6fb', ground: '#7fb07a', light: 1.3, grass: '#8fd28a', sun: 2.4 },
  dusk: { sky: '#ffd9c2', ground: '#8a7aa8', light: 1.1, grass: '#86c88a', sun: 2 },
  night: { sky: '#c9d4ff', ground: '#3a4a7a', light: 1.05, grass: '#76b98e', sun: 1.5 },
};

interface Flyer {
  readonly group: Group;
  readonly from: Vector3;
  readonly to: Vector3;
  readonly born: number;
  readonly big: boolean;
  readonly element: DragonElement;
}

interface Spark {
  readonly mesh: Mesh;
  readonly velocity: Vector3;
  readonly born: number;
  readonly life: number;
}

/** The attack's look per element: what flies across and how it spins. */
function attackShape(element: DragonElement, big: boolean): Group {
  const group = new Group();
  const colors = ATTACK_COLORS[element];
  const scale = big ? 1.35 : 1;
  const glow = (color: string) => new MeshBasicMaterial({ color });
  switch (element) {
    case 'fire':
      group.add(ball(glow('#ffd43f'), 0.11 * scale, 0, 0, 0));
      group.add(ball(glow('#ff7a2f'), 0.16 * scale, -0.06, 0, 0, [1.3, 1, 1]));
      for (let i = 1; i < 5; i++)
        group.add(ball(glow(colors[i % 3]), (0.1 - i * 0.015) * scale, -i * 0.11, 0, 0));
      break;
    case 'water':
      for (let i = 0; i < 6; i++) {
        const drop = new Mesh(
          new ConeGeometry(0.07 * scale, 0.18 * scale, 12),
          glow(colors[i % 3]),
        );
        drop.rotation.z = Math.PI / 2;
        drop.position.set(-i * 0.1, Math.sin(i * 2) * 0.06, Math.cos(i * 2) * 0.06);
        group.add(drop, ball(glow(colors[i % 3]), 0.07 * scale, -i * 0.1 - 0.06, 0, 0));
      }
      break;
    case 'leaf':
      for (let i = 0; i < 7; i++) {
        const leaf = ball(glow(colors[i % 3]), 0.09 * scale, 0, 0, 0, [1.6, 0.35, 0.8]);
        const angle = (i / 7) * Math.PI * 2;
        leaf.position.set(-i * 0.05, Math.sin(angle) * 0.14, Math.cos(angle) * 0.14);
        leaf.rotation.set(angle, angle, 0);
        group.add(leaf);
      }
      break;
    case 'star':
      for (let i = 0; i < 4; i++) {
        const star = new Mesh(
          new OctahedronGeometry((0.13 - i * 0.02) * scale),
          glow(colors[i % 3]),
        );
        star.scale.set(1, 1, 0.45);
        star.position.set(-i * 0.14, Math.sin(i * 1.7) * 0.08, 0);
        group.add(star);
      }
      break;
    case 'cloud':
      for (const [x, y, r] of [
        [0, 0, 0.13],
        [-0.12, 0.06, 0.1],
        [-0.12, -0.06, 0.09],
        [-0.24, 0, 0.08],
      ])
        group.add(ball(glow(colors[0]), r * scale, x, y, 0));
      break;
    case 'rainbow':
      colors.forEach((color, i) =>
        group.add(ball(glow(color), 0.08 * scale, -i * 0.07, (i - 2.5) * 0.045, 0)),
      );
      break;
  }
  return group;
}

/**
 * The duel arena: the child's dragon on the left, the sprite on the right, a meadow clearing
 * between. Right answers send the dragon's element flying; the sprite glows and crackles as it
 * charges, zaps the dragon with a bolt, giggles at a miss and pops into sparkles when beaten.
 * A lost duel sends the dragon for a nap. Under calm motion the idle bobbing and swaying hold
 * still; attacks, hits and zaps still play because they carry the news.
 */
export class DuelWorld extends Stage implements StateWorld<ArenaFrame> {
  private dragon?: DragonModel;
  private dragonKey = '';
  private sprite?: SpriteModel;
  private frame?: ArenaFrame;
  private readonly hemi = new HemisphereLight('#fff6fb', '#7fb07a', 1.3);
  private readonly grass: Mesh;
  private readonly flyers: Flyer[] = [];
  private readonly sparks: Spark[] = [];
  private readonly sparkGeometry = new OctahedronGeometry(0.05);
  private readonly bolt = new Group();
  private readonly crackle = new Group();
  private readonly zees: Billboard[] = [];
  private readonly hits = new EventCounter();
  private readonly zaps = new EventCounter();
  private readonly giggles = new EventCounter();
  private hitAt = -10;
  private zapAt = -10;
  private giggleAt = -10;
  private wonAt = -10;
  private napAt = -10;
  private shakeAt = -10;
  private phase: ArenaFrame['phase'] = 'intro';

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { shadows: true, fov: 34 });
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.fill.intensity = 0.5;
    this.scene.add(this.hemi);
    this.sun.position.set(2, 6, 4);
    this.sun.shadow.camera.left = -3.5;
    this.sun.shadow.camera.right = 3.5;
    this.sun.shadow.camera.top = 3;
    this.sun.shadow.camera.bottom = -2;
    this.sun.shadow.radius = 4;
    const rim = new DirectionalLight('#c9b8ff', 1);
    rim.position.set(-3, 2.5, -3);
    this.scene.add(rim);
    this.grass = new Mesh(new CircleGeometry(14, 64), paint('#8fd28a', { roughness: 0.95 }));
    this.grass.rotation.x = -Math.PI / 2;
    this.grass.receiveShadow = true;
    this.scene.add(this.grass, this.buildArena());

    // The zap: a zig-zag of five glowing segments, shown for a moment.
    const boltMaterial = new MeshBasicMaterial({ color: '#ffe27a', transparent: true });
    for (let i = 0; i < 5; i++)
      this.bolt.add(new Mesh(new CylinderGeometry(0.035, 0.035, 1, 6), boltMaterial));
    this.bolt.visible = false;
    this.scene.add(this.bolt);
    // The charge: sparks circling the sprite, more and brighter as it fills.
    const crackleMaterial = new MeshBasicMaterial({ color: '#ffe27a', transparent: true });
    for (let i = 0; i < 8; i++) this.crackle.add(new Mesh(this.sparkGeometry, crackleMaterial));
    this.scene.add(this.crackle);
    // Three Zs float up from a napping dragon.
    for (let i = 0; i < 3; i++) {
      const label = new TextLabel('z', { ink: '#5b4a9a', weight: 600, width: 128, height: 128 });
      const z = new Billboard(new SpriteMaterial({ map: label.texture, transparent: true }));
      z.visible = false;
      this.zees.push(z);
      this.scene.add(z);
    }
  }

  setState(frame: ArenaFrame) {
    const previous = this.frame;
    this.frame = frame;
    const key = `${frame.dragon.id}:${frame.form}`;
    if (!this.dragon || key !== this.dragonKey) {
      if (this.dragon) this.drop(this.dragon.root);
      this.dragonKey = key;
      this.dragon = new DragonModel(frame.dragon, frame.form);
      this.dragon.root.position.copy(DRAGON_AT);
      this.dragon.root.rotation.y = 0.85;
      this.dragon.root.scale.setScalar(FORM_SCALE[frame.form] ?? FORM_SCALE[0]);
      this.dragon.root.traverse((object) => (object.castShadow = object instanceof Mesh));
      this.scene.add(this.dragon.root);
    }
    if (!this.sprite || this.sprite.id !== frame.sprite) {
      if (this.sprite) this.drop(this.sprite.root);
      this.sprite = new SpriteModel(frame.sprite);
      this.sprite.root.position.copy(SPRITE_AT);
      this.sprite.root.rotation.y = -0.6;
      this.scene.add(this.sprite.root);
    }
    if (!previous || previous.sky !== frame.sky) this.setSky(frame.sky);
    const hits = this.hits.take(frame.hits);
    if (frame.phase !== this.phase) {
      if (frame.phase === 'won') this.wonAt = this.elapsed + FLIGHT;
      if (frame.phase === 'napping') this.napAt = this.elapsed + 0.4;
      if (frame.phase === 'fighting' || frame.phase === 'intro') this.reset();
      this.phase = frame.phase;
    }
    this.dragon.sleeping = frame.phase === 'napping';
    if (hits) this.attack(frame.big, frame.dragon.element);
    if (this.zaps.take(frame.zaps)) {
      this.zapAt = this.elapsed;
      this.shakeAt = this.elapsed;
    }
    if (this.giggles.take(frame.giggles)) this.giggleAt = this.elapsed;
  }

  /** A fresh duel: the sprite is back and the dragon awake. */
  private reset() {
    this.wonAt = -10;
    this.napAt = -10;
    if (this.sprite) {
      this.sprite.root.visible = true;
      this.sprite.root.scale.setScalar(spriteScale(this.sprite.id));
      this.sprite.root.rotation.y = -0.6;
    }
  }

  private setSky(sky: DuelSky) {
    const look = SKIES[sky];
    this.hemi.color.set(look.sky);
    this.hemi.groundColor.set(look.ground);
    this.hemi.intensity = look.light;
    this.sun.intensity = look.sun;
    (this.grass.material as MeshStandardMaterial).color.set(look.grass);
  }

  override dispose() {
    this.sparkGeometry.dispose();
    super.dispose();
  }

  private drop(root: Group) {
    this.scene.remove(root);
    disposeTree(root);
  }

  private buildArena(): Group {
    const arena = new Group();
    const path = new Mesh(new CircleGeometry(1.9, 40), paint('#e9dcb8', { roughness: 1 }));
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.005;
    path.scale.set(1.45, 0.6, 1);
    path.receiveShadow = true;
    arena.add(path);
    // Two little standing stones mark each side's spot.
    for (const at of [DRAGON_AT, SPRITE_AT]) {
      const ring = new Mesh(new CircleGeometry(0.62, 32), paint('#d9c89c', { roughness: 1 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(at.x, 0.01, at.z);
      ring.receiveShadow = true;
      arena.add(ring);
    }
    // Round trees behind, mushrooms and flowers in front.
    const leaves = ['#5bb860', '#4fa45a', '#79c46f'];
    for (let i = 0; i < 9; i++) {
      const x = -4.4 + i * 1.1;
      const z = -2.3 - (i % 2) * 0.55;
      const trunk = new Mesh(new CylinderGeometry(0.08, 0.11, 0.7, 8), paint('#a57a4f'));
      trunk.position.set(x, 0.35, z);
      trunk.castShadow = true;
      const crown = ball(
        paint(leaves[i % 3], { roughness: 0.8 }),
        0.55 + (i % 3) * 0.1,
        x,
        1.05 + (i % 2) * 0.15,
        z,
      );
      arena.add(trunk, crown);
    }
    const petals = ['#ff8cbf', '#ffd43f', '#b79bff', '#fffefc'];
    for (let i = 0; i < 14; i++) {
      const x = -3.4 + ((i * 1.37) % 6.8);
      const z = 1.0 + ((i * 0.53) % 1.2);
      if (i % 4 === 0) {
        const stem = new Mesh(new CylinderGeometry(0.05, 0.06, 0.16, 10), paint('#fff4e0'));
        stem.position.set(x, 0.08, z);
        const cap = new Mesh(
          new SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
          paint('#ff6f7d'),
        );
        cap.position.set(x, 0.15, z);
        stem.castShadow = cap.castShadow = true;
        arena.add(stem, cap);
      } else {
        arena.add(ball(paint(petals[i % 4]), 0.06, x, 0.07, z, [1, 0.6, 1]));
      }
    }
    return arena;
  }

  private attack(big: boolean, element: DragonElement) {
    const group = attackShape(element, big);
    const from = DRAGON_AT.clone().add(new Vector3(0.45, 0.85, 0.25));
    const to = SPRITE_AT.clone().add(new Vector3(-0.2, 0.75, 0.2));
    group.position.copy(from);
    this.scene.add(group);
    this.flyers.push({ group, from, to, born: this.elapsed, big, element });
    this.dragon?.cheer(this.elapsed);
  }

  private burst(at: Vector3, count: number, colors: readonly string[], speed: number) {
    for (let i = 0; i < count; i++) {
      const mesh = new Mesh(
        this.sparkGeometry,
        new MeshBasicMaterial({ color: new Color(colors[i % colors.length]), transparent: true }),
      );
      mesh.position.copy(at);
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const velocity = new Vector3(
        Math.cos(angle),
        0.6 + Math.random(),
        Math.sin(angle) * 0.6 + 0.4,
      ).multiplyScalar(speed * (0.5 + Math.random() * 0.6));
      this.scene.add(mesh);
      this.sparks.push({ mesh, velocity, born: this.elapsed, life: 0.8 + Math.random() * 0.4 });
    }
  }

  protected override layout(aspect: number) {
    this.camera.aspect = aspect;
    // Both fighters in frame: about 5 units wide and 2.6 tall around the clearing.
    const tan = Math.tan((this.camera.fov * Math.PI) / 360);
    // A tall arena (a phone held upright) frames a little tighter and looks a little down.
    const tall = aspect < 1;
    const distance = Math.max(2.6 / (2 * tan), (tall ? 4.9 : 5.2) / (2 * tan * aspect));
    // Upright, the fighters sit lower so the sky (where the HUD is) takes the extra height.
    const lift = tall ? Math.min(0.5, (1 / aspect - 1) * 0.6) : 0;
    this.camera.position.set(0, 0.8 + distance * 0.28 + lift, distance);
    this.camera.lookAt(0, 0.7 + lift, 0);
    this.camera.updateProjectionMatrix();
  }

  protected override update(dt: number, now: number) {
    const frame = this.frame;
    const dragon = this.dragon;
    const sprite = this.sprite;
    if (!frame || !dragon || !sprite) return;
    const calm = this.calm;
    const napping = frame.phase === 'napping' && now >= this.napAt;
    dragon.update(now, true, calm || napping);
    // A napping dragon slumps sideways; a zapped one shakes.
    const zapped = now - this.zapAt;
    dragon.root.rotation.z += ((napping ? 0.45 : 0) - dragon.root.rotation.z) * Math.min(1, dt * 4);
    dragon.root.position.x =
      DRAGON_AT.x + (zapped < 0.6 ? Math.sin(zapped * 50) * 0.07 * (1 - zapped / 0.6) : 0);
    this.zees.forEach((z, index) => {
      const age = (now - this.napAt + index * 0.8) % 2.4;
      z.visible = napping;
      if (!napping) return;
      const rise = calm ? 0.4 + index * 0.25 : age / 2.4;
      z.position.set(DRAGON_AT.x + 0.3 + rise * 0.4, 1.1 + rise * 0.9, DRAGON_AT.z + 0.2);
      z.scale.setScalar(0.22 + index * 0.06);
      (z.material as SpriteMaterial).opacity = calm ? 1 : Math.min(1, (1 - rise) * 2);
    });

    // The sprite bobs, swells and glows as it charges, giggles at a miss and reels from a hit.
    const charge = frame.phase === 'fighting' ? frame.charge : 0;
    const hit = now - this.hitAt;
    const giggle = now - this.giggleAt;
    const bob = calm ? 0 : Math.sin(now * 2.4) * (sprite.floats ? 0.09 : 0.03);
    const knock = hit < 0.5 ? Math.sin((hit / 0.5) * Math.PI) * 0.35 : 0;
    const lunge = zapped < 0.5 ? Math.sin((zapped / 0.5) * Math.PI) * -0.5 : 0;
    sprite.root.position.set(
      SPRITE_AT.x + knock + lunge,
      bob + (sprite.floats ? 0.25 : 0.02),
      SPRITE_AT.z,
    );
    sprite.body.rotation.z = giggle < 0.9 ? Math.sin(giggle * 24) * 0.14 * (1 - giggle / 0.9) : 0;
    const squash = hit < 0.3 ? 1 - Math.sin((hit / 0.3) * Math.PI) * 0.2 : 1;
    const tremble = charge > 0.7 && !calm ? Math.sin(now * 40) * 0.015 : 0;
    const swell = 1 + charge * 0.1;
    sprite.body.scale.set(swell + tremble, swell * squash, swell);
    sprite.skin.emissiveIntensity = hit < 0.25 ? 0.9 : charge * 0.6;
    sprite.skin.emissive.set(hit < 0.25 ? '#fffefc' : '#ffe27a');
    sprite.blink(hit < 0.3 || giggle < 0.5 || (!calm && now % 3.7 < 0.12));
    sprite.update(now, calm);

    // Charge sparks circle the sprite: more of them, faster and brighter as it fills.
    const shown = Math.round(charge * this.crackle.children.length);
    this.crackle.children.forEach((spark, index) => {
      spark.visible = index < shown;
      const angle = now * (2 + charge * 4) + (index / this.crackle.children.length) * Math.PI * 2;
      spark.position.set(
        sprite.root.position.x + Math.cos(angle) * 0.8,
        sprite.root.position.y + 0.8 + Math.sin(angle * 1.7) * 0.3,
        SPRITE_AT.z + Math.sin(angle) * 0.8,
      );
      spark.scale.setScalar(1 + charge);
    });

    // The beaten sprite spins away into sparkles.
    const gone = now - this.wonAt;
    if (frame.phase === 'won' && gone >= 0 && sprite.root.visible) {
      const t = Math.min(1, gone / 0.6);
      sprite.root.scale.setScalar(spriteScale(sprite.id) * (1 - easeOut(t)));
      sprite.root.rotation.y = -0.6 + t * 8;
      if (gone - dt < 0) {
        this.burst(
          SPRITE_AT.clone().add(new Vector3(0, 0.7, 0)),
          40,
          [...ATTACK_COLORS.rainbow, '#ffe27a'],
          2.4,
        );
        dragon.cheer(now);
      }
      if (t >= 1) sprite.root.visible = false;
    }
    if (frame.phase === 'won' && gone > 0.8 && !calm && (gone % 1.6) - dt < 0) dragon.cheer(now);

    // The zap: a zig-zag bolt from the sprite to the dragon.
    if (zapped > 0.12 && zapped < 0.42) {
      const from = SPRITE_AT.clone().add(new Vector3(-0.4, 0.8, 0.05));
      const to = DRAGON_AT.clone().add(new Vector3(0.25, 0.7, 0.1));
      const points = [from];
      for (let i = 1; i < 5; i++)
        points.push(
          from
            .clone()
            .lerp(to, i / 5)
            .add(new Vector3(0, i % 2 ? 0.22 : -0.18, 0)),
        );
      points.push(to);
      this.bolt.children.forEach((segment, index) => {
        const a = points[index];
        const b = points[index + 1];
        segment.position.copy(a).add(b).multiplyScalar(0.5);
        segment.scale.set(1, a.distanceTo(b), 1);
        segment.rotation.set(0, 0, Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2);
      });
      this.bolt.visible = true;
      if (zapped - dt <= 0.12) this.burst(to, 12, ['#ffe27a', '#fffefc'], 1.4);
    } else this.bolt.visible = false;

    // A little camera shake on a zap or a big hit.
    const shake = now - this.shakeAt;
    this.camera.position.x = shake < 0.35 && !calm ? Math.sin(shake * 60) * 0.05 : 0;

    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const flyer = this.flyers[i];
      const t = (now - flyer.born) / FLIGHT;
      if (t >= 1) {
        this.scene.remove(flyer.group);
        disposeTree(flyer.group);
        this.flyers.splice(i, 1);
        this.hitAt = now;
        if (flyer.big) this.shakeAt = now;
        this.burst(
          flyer.to,
          flyer.big ? 28 : 16,
          ATTACK_COLORS[flyer.element],
          flyer.big ? 2.2 : 1.5,
        );
        continue;
      }
      flyer.group.position.lerpVectors(flyer.from, flyer.to, t);
      flyer.group.position.y += Math.sin(t * Math.PI) * 0.35;
      if (flyer.element === 'leaf' || flyer.element === 'star') flyer.group.rotation.x += dt * 10;
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i];
      const age = now - spark.born;
      if (age > spark.life) {
        this.scene.remove(spark.mesh);
        (spark.mesh.material as Material).dispose();
        this.sparks.splice(i, 1);
        continue;
      }
      spark.velocity.y -= 3 * dt;
      spark.mesh.position.addScaledVector(spark.velocity, dt);
      (spark.mesh.material as MeshBasicMaterial).opacity = 1 - age / spark.life;
    }
  }
}
