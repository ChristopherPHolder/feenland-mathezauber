import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  Line,
  Material,
  Mesh,
  NeutralToneMapping,
  NoToneMapping,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  Points,
  Scene,
  Sprite,
  SRGBColorSpace,
  Texture,
  ToneMapping,
  WebGLRenderer,
} from 'three';
import { QualityGovernor, QualityLevel, qualityLevels } from './quality';

/** Longest step a frame may take, so a tab coming back does not fast-forward the world. */
const MAX_STEP = 0.1;

export interface StageOptions {
  /** Cast shadows from the key light. Costs a little; worth it for characters on the ground. */
  readonly shadows?: boolean;
  /** Vertical field of view in degrees. */
  readonly fov?: number;
  /** Sky colour behind everything. */
  readonly background?: string;
  /**
   * How far shadow edges blur, in shadow-map texels (default 2; 1 is a hard edge). Soft edges
   * read as daylight and hide the stair-steps of the shadow map.
   */
  readonly shadowSoftness?: number;
  /**
   * Rolls off highlights instead of clipping them, so bright pastel surfaces under a strong sun
   * keep their shading. Off by default because it shifts a palette tuned without it: `neutral`
   * keeps colours closest to how they were picked, `agx` and `aces` are more filmic.
   */
  readonly toneMapping?: 'neutral' | 'agx' | 'aces';
  /** Brightness before tone mapping; only used with `toneMapping`. */
  readonly exposure?: number;
  /**
   * Lowers the pixel ratio (and then the shadow map) while frames come slowly and raises it
   * back when there is headroom. On by default.
   */
  readonly adaptive?: boolean;
}

const TONE_MAPPING: Record<NonNullable<StageOptions['toneMapping']>, ToneMapping> = {
  neutral: NeutralToneMapping,
  agx: AgXToneMapping,
  aces: ACESFilmicToneMapping,
};

/**
 * A Three.js world drawn into a canvas that CSS stretches over its host element. It owns the
 * renderer, the scene, a camera, a key and fill light, resizing, the frame loop and clean-up, so
 * a game only builds its objects and says how they move each frame.
 *
 * The loop sleeps while the tab is hidden or the host is scrolled away. `calm` is true while
 * the device asks for reduced motion or the Settings calm-motion switch is on: worlds should
 * then hold their idle wobble and keep only the movement that carries meaning.
 *
 * Render quality adapts to the device: the canvas starts at retina sharpness (capped at 2) and
 * steps the pixel ratio down while frames come slowly, then the shadow map, and back up when
 * there is headroom. Set `adaptive = false` to hold the best level.
 *
 * Subclasses override `update` (called every frame) and optionally `layout` (on resize).
 */
export abstract class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly sun = new DirectionalLight('#fff6e0', 2.4);
  readonly fill = new AmbientLight('#dfe9ff', 1.2);
  /** Seconds since the world started, paused while asleep. */
  protected elapsed = 0;
  protected width = 1;
  protected height = 1;
  /** Adapt render quality to the frame rate; false holds the best level. */
  adaptive: boolean;
  private readonly governor: QualityGovernor;
  /** The world's own shadow map size, read on the first change so a world may set its own. */
  private shadowSize = 0;
  private handle = 0;
  private last = 0;
  private visible = true;
  private onScreen = true;
  private disposed = false;
  private readonly resizeObserver: ResizeObserver;
  private readonly viewObserver?: IntersectionObserver;
  private readonly motionQuery?: MediaQueryList;
  private readonly rootObserver?: MutationObserver;
  private readonly onVisibility = () => this.wake();

  constructor(
    protected readonly canvas: HTMLCanvasElement,
    protected readonly host: HTMLElement,
    options: StageOptions = {},
  ) {
    const shadows = !!options.shadows;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: !options.background });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = options.toneMapping
      ? TONE_MAPPING[options.toneMapping]
      : NoToneMapping;
    this.renderer.toneMappingExposure = options.exposure ?? 1;
    this.adaptive = options.adaptive ?? true;
    this.governor = new QualityGovernor(qualityLevels(window.devicePixelRatio || 1, shadows));
    this.renderer.setPixelRatio(this.governor.level.pixelRatio);
    this.renderer.shadowMap.enabled = shadows;
    // Three.js filters PCF shadows with a rotated disc of samples; the radius sets how soft.
    this.renderer.shadowMap.type = PCFShadowMap;
    if (options.background) this.scene.background = new Color(options.background);
    this.camera = new PerspectiveCamera(options.fov ?? 45, 1, 0.1, 200);
    this.sun.position.set(4, 10, 6);
    this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.radius = options.shadowSoftness ?? 2;
    this.scene.add(this.sun, this.fill);

    // Watch the canvas box itself (CSS stretches it over the host, see ThreeStage): the observer
    // reports its exact fractional size, so the drawing buffer lands on whole device pixels
    // instead of being resampled, and host padding cannot skew it. It fires after layout and
    // before paint, and `resize` redraws at once, so a rotation never shows a stretched frame.
    this.resizeObserver = new ResizeObserver(([entry]) =>
      this.resize(entry?.contentRect.width, entry?.contentRect.height),
    );
    this.resizeObserver.observe(canvas);
    if (typeof IntersectionObserver !== 'undefined') {
      this.viewObserver = new IntersectionObserver(([entry]) => {
        this.onScreen = entry?.isIntersecting ?? true;
        this.wake();
      });
      this.viewObserver.observe(host);
    }
    const doc = host.ownerDocument;
    doc.addEventListener('visibilitychange', this.onVisibility);
    this.motionQuery = doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (typeof MutationObserver !== 'undefined') {
      this.rootObserver = new MutationObserver(() => this.wake());
      this.rootObserver.observe(doc.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }
    // Defer the first frame so subclass constructors finish building before update() runs.
    queueMicrotask(() => {
      if (this.disposed) return;
      this.resize();
      this.wake();
    });
  }

  /** True while motion should be kept to what carries meaning. */
  get calm(): boolean {
    return (
      !!this.motionQuery?.matches ||
      this.host.ownerDocument.documentElement.classList.contains('calm-motion')
    );
  }

  /** Move the world on by `dt` seconds; `t` is the running clock. */
  protected abstract update(dt: number, t: number): void;

  /** Called after the canvas changes size; frame the camera for the new aspect here. */
  protected layout(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Draws one frame now, for worlds that changed while the loop sleeps. */
  protected draw() {
    if (!this.disposed) this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.handle);
    this.resizeObserver.disconnect();
    this.viewObserver?.disconnect();
    this.rootObserver?.disconnect();
    this.host.ownerDocument.removeEventListener('visibilitychange', this.onVisibility);
    disposeTree(this.scene);
    this.renderer.dispose();
  }

  private resize(boxWidth = this.canvas.clientWidth, boxHeight = this.canvas.clientHeight) {
    const width = Math.max(1, boxWidth);
    const height = Math.max(1, boxHeight);
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.layout(width / height);
    this.draw();
  }

  private get awake(): boolean {
    return !this.disposed && this.onScreen && this.host.ownerDocument.visibilityState !== 'hidden';
  }

  private wake() {
    if (!this.awake || this.handle) return;
    this.last = 0;
    this.governor.pause();
    this.handle = requestAnimationFrame((time) => this.loop(time));
  }

  private loop(time: number) {
    this.handle = 0;
    if (!this.awake) return;
    const interval = this.last ? (time - this.last) / 1000 : 0;
    const dt = this.last ? Math.min(MAX_STEP, interval) : 1 / 60;
    this.last = time;
    this.adapt(interval);
    this.elapsed += dt;
    this.update(dt, this.elapsed);
    this.renderer.render(this.scene, this.camera);
    this.handle = requestAnimationFrame((next) => this.loop(next));
  }

  /** Feeds the frame time to the governor and applies its level before this frame draws. */
  private adapt(interval: number) {
    if (this.adaptive) {
      const level = interval > 0 ? this.governor.sample(interval) : undefined;
      if (level) this.apply(level);
    } else if (this.governor.level !== this.governor.levels[0]) {
      this.apply(this.governor.reset());
    }
  }

  private apply(level: QualityLevel) {
    // Resizing the drawing buffer clears it, but this frame redraws it before the browser paints.
    if (this.renderer.getPixelRatio() !== level.pixelRatio) {
      this.renderer.setPixelRatio(level.pixelRatio);
    }
    const shadow = this.sun.shadow;
    if (!this.sun.castShadow) return;
    this.shadowSize ||= shadow.mapSize.x;
    const size = Math.max(256, Math.round(this.shadowSize * level.shadowScale));
    if (shadow.mapSize.x === size) return;
    shadow.mapSize.set(size, size);
    // Three.js builds a new map at the new size on the next shadow pass.
    shadow.map?.dispose();
    shadow.map = null;
  }
}

/** Frees every geometry, material and texture under `root`. */
export function disposeTree(root: Object3D) {
  root.traverse((object) => {
    const drawn =
      object instanceof Mesh ||
      object instanceof Sprite ||
      object instanceof Points ||
      object instanceof Line;
    if (!drawn) return;
    object.geometry.dispose();
    const materials: Material[] = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof Texture) value.dispose();
      material.dispose();
    }
  });
}
