import {
  AmbientLight,
  Color,
  DirectionalLight,
  Material,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Scene,
  Sprite,
  Texture,
  WebGLRenderer,
} from 'three';

/** Longest step a frame may take, so a tab coming back does not fast-forward the world. */
const MAX_STEP = 0.1;

export interface StageOptions {
  /** Cast shadows from the key light. Costs a little; worth it for characters on the ground. */
  readonly shadows?: boolean;
  /** Vertical field of view in degrees. */
  readonly fov?: number;
  /** Sky colour behind everything. */
  readonly background?: string;
}

/**
 * A Three.js world drawn into a canvas that fills its host element. It owns the renderer, the
 * scene, a camera, a key and fill light, resizing, the frame loop and clean-up, so a game only
 * builds its objects and says how they move each frame.
 *
 * The loop sleeps while the tab is hidden or the host is scrolled away. `calm` is true while
 * the device asks for reduced motion or the Settings calm-motion switch is on: worlds should
 * then hold their idle wobble and keep only the movement that carries meaning.
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
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: !options.background });
    // Retina sharpness without paying for 3x on large tablets.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = !!options.shadows;
    if (options.background) this.scene.background = new Color(options.background);
    this.camera = new PerspectiveCamera(options.fov ?? 45, 1, 0.1, 200);
    this.sun.position.set(4, 10, 6);
    this.sun.castShadow = !!options.shadows;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.sun, this.fill);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
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

  private resize() {
    const width = Math.max(1, Math.round(this.host.clientWidth));
    const height = Math.max(1, Math.round(this.host.clientHeight));
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
    this.handle = requestAnimationFrame((time) => this.loop(time));
  }

  private loop(time: number) {
    this.handle = 0;
    if (!this.awake) return;
    const dt = this.last ? Math.min(MAX_STEP, (time - this.last) / 1000) : 1 / 60;
    this.last = time;
    this.elapsed += dt;
    this.update(dt, this.elapsed);
    this.renderer.render(this.scene, this.camera);
    this.handle = requestAnimationFrame((next) => this.loop(next));
  }
}

/** Frees every geometry, material and texture under `root`. */
export function disposeTree(root: Object3D) {
  root.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof Sprite)) return;
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
