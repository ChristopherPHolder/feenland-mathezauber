import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
} from 'three';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { RAINBOW } from './dragon-model';
import type { Dragon } from './dragons';
import { buildNest, EGG_HEIGHT, EggModel, SPLIT } from './egg-model';

/** A warm, speckled ember egg: the colours only, the loader never touches the hatchery's rules. */
const EMBER_EGG: Dragon = {
  id: 'ember',
  element: 'fire',
  starlight: false,
  body: '#f2703f',
  belly: '#ffd9a0',
  wing: '#ffb15e',
  accent: '#ffd43f',
  shell: '#ffe2c6',
  spots: '#f2703f',
};

/** One full wobble, glint and rest, in seconds. Every motion repeats on it, so the loop is seamless. */
export const LOOP = 2.8;
/** Starts the clock just before a wobble, so the egg moves the moment it appears. */
const LEAD = 0.08;
const WOBBLE = 1.2;
const GLINT_AT = 1.05;
const GLINT_FOR = 0.8;
const SPARKLES = 5;
const CRACK_Y = SPLIT * EGG_HEIGHT + 0.06;

/** Seconds into the current loop at running time `t`. */
export const loopTime = (t: number) => (((t + LOOP - LEAD) % LOOP) + LOOP) % LOOP;

/** A hump from 0 up to 1 and back to 0 over `length` seconds from `start`; 0 outside it. */
export const hump = (u: number, start: number, length: number) => {
  const x = (u - start) / length;
  return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x);
};

/** How far the egg rocks (radians) at `u` seconds into the loop: a wriggle that starts and ends still. */
export const rock = (u: number) =>
  hump(u, 0, WOBBLE) ** 1.5 * Math.sin((u / WOBBLE) * Math.PI * 5) * 0.17;

function starTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.18, 'rgba(255,240,200,0.75)');
    glow.addColorStop(1, 'rgba(255,220,150,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, 64, 64);
    // Four thin rays, like light catching on a crack.
    context.fillStyle = '#fff';
    context.beginPath();
    for (let i = 0; i < 8; i++) {
      const radius = i % 2 ? 4 : 31;
      const angle = (i / 8) * Math.PI * 2;
      context.lineTo(32 + Math.cos(angle) * radius, 32 + Math.sin(angle) * radius);
    }
    context.closePath();
    context.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function shadowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const shade = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    shade.addColorStop(0, 'rgba(70,40,60,0.38)');
    shade.addColorStop(1, 'rgba(70,40,60,0)');
    context.fillStyle = shade;
    context.fillRect(0, 0, 64, 64);
  }
  return new CanvasTexture(canvas);
}

/**
 * The hatchery's loading scene: a speckled egg in its straw nest, wriggling as if something
 * inside wants out, with light glinting from its crack and sparkles drifting up. Under calm
 * motion it sits still, tilted, with the glint lit and the glow breathing very slowly.
 */
export class HatcheryLoaderWorld extends Stage implements StateWorld<null> {
  private readonly pivot = new Group();
  private readonly egg = new EggModel(EMBER_EGG, { segments: 24, rows: 12, shadows: false });
  private readonly glint: Sprite;
  private readonly sparkles: Sprite[] = [];

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 30 });
    this.fill.intensity = 0.5;
    this.scene.add(new HemisphereLight('#fff6fb', '#7fb07a', 1.3));
    this.sun.color.set('#fff3e0');
    this.sun.intensity = 2.2;
    this.sun.position.set(2.5, 5, 3.5);
    const rim = new DirectionalLight('#c9b8ff', 1.1);
    rim.position.set(-3, 2.5, -3);
    this.scene.add(rim);

    const shadow = new Mesh(
      new CircleGeometry(1, 24),
      new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.setScalar(1.05);
    this.scene.add(shadow, buildNest({ lite: true, shadows: false }));

    // Two taps' worth of crack, turned so it runs across the front of the egg.
    this.egg.setCracks(2);
    this.egg.glowCracks(2, '#ffc861');
    this.egg.root.rotation.y = (-2 * Math.PI) / 3;
    // Rock on the bottom of the egg, where it rests in the nest.
    this.pivot.position.y = 0.06;
    this.pivot.add(this.egg.root);
    this.scene.add(this.pivot);

    const star = starTexture();
    this.glint = new Sprite(
      new SpriteMaterial({
        map: star,
        blending: AdditiveBlending,
        depthWrite: false,
        color: '#fff3c4',
      }),
    );
    this.glint.position.set(0.24, CRACK_Y - 0.02, 0.4);
    this.pivot.add(this.glint);
    for (let i = 0; i < SPARKLES; i++) {
      const sparkle = new Sprite(
        new SpriteMaterial({
          map: star,
          color: RAINBOW[(i * 2) % RAINBOW.length],
          blending: AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }),
      );
      this.sparkles.push(sparkle);
      this.scene.add(sparkle);
    }
  }

  setState(_: null) {}

  protected override layout(aspect: number) {
    this.camera.aspect = aspect;
    // Keep the nest, the egg and the sparkles above it (about 1.6 units tall) in the top half,
    // with room round them, so the loading label just below the middle stays clear.
    const tan = Math.tan((this.camera.fov * Math.PI) / 360);
    const distance = Math.max(3.3 / (2 * tan), 2.1 / (2 * tan * aspect));
    const lift = 2 * distance * tan * 0.22;
    this.camera.position.set(0, 0.62 + distance * 0.3 - lift, distance);
    this.camera.lookAt(0, 0.62 - lift, 0);
    this.camera.updateProjectionMatrix();
  }

  protected override update(_dt: number, now: number) {
    const calm = this.calm;
    const u = loopTime(now);
    const wobble = calm ? 0 : hump(u, 0, WOBBLE);
    const glint = calm ? 0.7 : hump(u, GLINT_AT, GLINT_FOR);

    this.pivot.rotation.z = calm ? 0.06 : rock(u);
    this.pivot.position.y =
      0.06 + (calm ? 0 : wobble * Math.abs(Math.sin((u / WOBBLE) * Math.PI * 5)) * 0.04);
    const glow = calm ? 0.75 + Math.sin(now * 0.6) * 0.08 : 0.55 + wobble * 0.5 + glint * 0.4;
    for (const material of this.egg.shellMaterial) material.emissiveIntensity = glow;

    this.glint.visible = glint > 0.01;
    this.glint.scale.setScalar(0.08 + glint * 0.26);
    this.glint.material.rotation = calm ? 0.3 : (u - GLINT_AT) * 1.6;
    this.glint.material.opacity = glint;

    for (const [index, sparkle] of this.sparkles.entries()) {
      // The sparkles fan out from round the egg, each on its own slice of the loop.
      const s = calm ? 0.4 : (u / LOOP + index / SPARKLES) % 1;
      const angle = Math.PI * (0.18 + (0.64 * ((index * 2) % SPARKLES)) / (SPARKLES - 1));
      const reach = 0.56 + s * 0.34;
      sparkle.visible = !calm || index % 2 === 0;
      sparkle.position.set(Math.cos(angle) * reach, CRACK_Y + Math.sin(angle) * reach, 0.1);
      sparkle.scale.setScalar(0.09 + Math.sin(Math.PI * s) * 0.06);
      sparkle.material.opacity = Math.sin(Math.PI * s);
    }
  }
}
