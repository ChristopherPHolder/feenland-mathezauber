import { Component, input } from '@angular/core';
import { MagicIcon, MagicMotif } from '../magic-icon/magic-icon';
@Component({
  selector: 'app-sticker-album',
  imports: [MagicIcon],
  template: `<section class="sticker-shelf" aria-labelledby="stickers-title">
    <div class="album-intro">
      <h2 id="stickers-title">Friendship stickers</h2>
      <p>A little thank-you for every treat.</p>
    </div>
    <div class="sticker-slots">
      @for (slot of slots; track slot) {
        <div
          class="sticker-slot"
          role="img"
          [class.earned]="earned() > slot"
          [attr.aria-label]="
            earned() > slot
              ? stickers[slot] + ' sticker earned'
              : 'Sticker ' + (slot + 1) + ' to collect'
          "
        >
          @if (earned() > slot) {
            <span class="sticker-art" aria-hidden="true"
              ><app-magic-icon [kind]="motifs[slot]" /></span
            ><span class="sticker-name">{{ stickers[slot] }}</span>
          } @else {
            <app-magic-icon kind="star" />
          }
        </div>
      }
    </div>
  </section>`,
  styles: `
    :host {
      display: block;
    }
    h2 {
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .sticker-shelf {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      background: #d5ebde;
      padding: 24px 36px;
      border-radius: 16px;
      margin: 20px 0 0;
    }
    .album-intro h2 {
      font-size: 22px;
      margin: 0 0 7px;
      color: #305d48;
    }
    .album-intro p {
      font-size: 14px;
      margin: 0;
      color: #456957;
    }
    .sticker-slots {
      display: flex;
      gap: 12px;
    }
    .sticker-slot {
      width: 68px;
      height: 68px;
      border: 2px dashed #87ad96;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #789c86;
      font-size: 30px;
    }
    .sticker-slot.earned {
      border: 0;
      background: #fff5cf;
      color: #a02d5b;
      transform: rotate(-8deg);
      box-shadow: 0 3px 7px #284e3410;
      animation: sticker-pop 0.4s ease-out;
    }
    .sticker-slot.earned:nth-child(even) {
      background: #e6d8fa;
      transform: rotate(8deg);
    }
    .sticker-art {
      font-size: 27px;
      line-height: 1;
    }
    .sticker-name {
      font-size: 9px;
      margin-top: 3px;
    }

    @media (max-width: 760px) {
      .sticker-shelf {
        flex-direction: column;
        text-align: center;
        gap: 18px;
        padding: 21px 12px;
      }
      .album-intro h2 {
        font-size: 22px;
      }
      .sticker-slots {
        gap: 8px;
        width: 100%;
        justify-content: center;
      }
      .sticker-slot {
        width: 54px;
        height: 54px;
        flex-shrink: 0;
        font-size: 24px;
      }
      .sticker-name {
        font-size: 8px;
      }
      .sticker-art {
        font-size: 23px;
      }
    }

    @keyframes sticker-pop {
      from {
        transform: scale(0.5) rotate(-18deg);
      }
      to {
        transform: scale(1) rotate(-8deg);
      }
    }
    .sticker-shelf {
      margin: 0 0 18px;
      padding: 14px 24px;
      gap: 14px;
    }
    .album-intro h2 {
      font-size: 18px;
    }
    .sticker-slot {
      width: 48px;
      height: 48px;
      font-size: 23px;
    }
    .sticker-art {
      font-size: 22px;
    }
    .sticker-name {
      font-size: 7px;
    }
    .sticker-slots {
      gap: 10px;
    }
    .sticker-slot.earned:nth-child(3) {
      color: #317151;
      background: #e8f5d7;
    }
    .sticker-slot.earned:nth-child(4) {
      color: #68409a;
    }
    .sticker-slot.earned:nth-child(5) {
      color: #96640d;
      background: #fff0bb;
    }
    @media (max-width: 760px) {
      .sticker-shelf {
        flex-direction: row;
        text-align: left;
        padding: 11px 12px;
        gap: 8px;
        margin-bottom: 16px;
      }
      .album-intro h2 {
        font-size: 13px;
        line-height: 1.25;
        margin: 0;
      }
      .album-intro p {
        display: none;
      }
      .sticker-slots {
        width: auto;
        gap: 5px;
      }
      .sticker-slot {
        width: 32px;
        height: 32px;
        font-size: 17px;
      }
      .sticker-art {
        font-size: 18px;
      }
      .sticker-name {
        display: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .sticker-slot {
        animation: none !important;
      }
    }
  `,
})
export class StickerAlbum {
  readonly earned = input.required<number>();
  protected readonly motifs: readonly MagicMotif[] = ['heart', 'flower', 'leaf', 'gem', 'star'];
  protected readonly slots = [0, 1, 2, 3, 4];
  protected readonly stickers = [
    'Berry buddy',
    'Kind chef',
    'Clever counter',
    'Sweet helper',
    'Garden star',
  ];
}
