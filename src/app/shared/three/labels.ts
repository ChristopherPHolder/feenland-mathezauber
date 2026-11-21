import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';

export interface LabelStyle {
  /** Text colour. */
  readonly ink?: string;
  /** Fill behind the text; omit for a transparent label. */
  readonly fill?: string;
  /** Border colour, drawn when there is a fill. */
  readonly border?: string;
  /** Font weight; the app's Fredoka has 400 and 600. */
  readonly weight?: 400 | 600;
  /** Canvas size in pixels; keep the aspect of the face it is drawn on. */
  readonly width?: number;
  readonly height?: number;
  /** Corner radius as a share of the height. */
  readonly radius?: number;
}

/**
 * Draws text (a number on a brick, a sum on a snack) onto a canvas texture in the app's font,
 * for use as a `map` on a plane or a sprite. Call `label.update(text)` to change it in place.
 */
export class TextLabel {
  readonly texture: CanvasTexture;
  private readonly context: CanvasRenderingContext2D;
  private text = '';

  constructor(
    text: string,
    private readonly style: LabelStyle = {},
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = style.width ?? 256;
    canvas.height = style.height ?? 256;
    this.context = canvas.getContext('2d')!;
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;
    // Mipmaps and anisotropic filtering keep small or tilted numbers crisp instead of shimmering.
    this.texture.minFilter = LinearMipmapLinearFilter;
    this.texture.anisotropy = 4;
    this.update(text);
    // Repaint once Fredoka has loaded, in case the first paint used a fallback font.
    void document.fonts?.ready.then(() => this.paint());
  }

  update(text: string) {
    if (text === this.text) return;
    this.text = text;
    this.paint();
  }

  private paint() {
    const { context: c, style } = this;
    const { width, height } = c.canvas;
    c.clearRect(0, 0, width, height);
    if (style.fill) {
      const r = (style.radius ?? 0.2) * height;
      c.beginPath();
      c.roundRect(4, 4, width - 8, height - 8, r);
      c.fillStyle = style.fill;
      c.fill();
      if (style.border) {
        c.lineWidth = 8;
        c.strokeStyle = style.border;
        c.stroke();
      }
    }
    let size = height * 0.62;
    const font = (px: number) => `${style.weight ?? 600} ${px}px Fredoka, system-ui, sans-serif`;
    c.font = font(size);
    // Shrink long sums until they fit with a margin.
    while (size > 12 && c.measureText(this.text).width > width * 0.86) {
      size -= 4;
      c.font = font(size);
    }
    c.fillStyle = style.ink ?? '#16264f';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(this.text, width / 2, height / 2 + size * 0.04);
    this.texture.needsUpdate = true;
  }
}
