import { Component, input } from '@angular/core';

/**
 * The cheeky troll who marches on the wall: green, big-nosed, one tooth, a club on his
 * shoulder. He is drawn facing right; the scene mirrors him so he walks toward the wall.
 * Legs and club swing while he marches, he shuts his eyes under fairy dust, frowns when he is
 * close, swings the club on a bonk and dances when the wall comes down.
 */
@Component({
  selector: 'app-wall-troll',
  styleUrl: './wall-troll.css',
  host: {
    'aria-hidden': 'true',
    '[class.is-asleep]': 'asleep()',
    '[class.is-bonking]': 'bonking()',
    '[class.is-cheering]': 'cheering()',
    '[class.is-angry]': 'angry()',
  },
  template: `
    <svg viewBox="0 0 120 150" focusable="false">
      <g class="leg leg-back">
        <rect x="60" y="102" width="17" height="34" rx="8" fill="#4d8a3b" />
        <ellipse cx="73" cy="138" rx="15" ry="7" fill="#3b6b2c" />
      </g>
      <g class="leg leg-front">
        <rect x="40" y="102" width="17" height="34" rx="8" fill="#5c9d46" />
        <ellipse cx="53" cy="138" rx="15" ry="7" fill="#467c36" />
      </g>
      <g class="torso">
        <g class="club">
          <path d="M30 86 18 26" stroke="#6b3f1d" stroke-width="8" stroke-linecap="round" />
          <ellipse cx="16" cy="20" rx="12" ry="17" fill="#8b5a2b" transform="rotate(-12 16 20)" />
          <circle cx="11" cy="14" r="2.4" fill="#5e3a19" />
          <circle cx="20" cy="24" r="2" fill="#5e3a19" />
          <circle cx="30" cy="84" r="8" fill="#6aab52" />
        </g>
        <ellipse cx="58" cy="88" rx="33" ry="29" fill="#6aab52" />
        <path d="M27 94q31-12 62 0l-4 18q-27 9-54 0z" fill="#8b5a2b" />
        <path d="M34 100h48" stroke="#6b3f1d" stroke-width="3" stroke-dasharray="5 4" />
        <path
          class="arm"
          d="M84 80q14 10 12 26"
          stroke="#6aab52"
          stroke-width="11"
          fill="none"
          stroke-linecap="round"
        />
        <circle cx="96" cy="108" r="7.5" fill="#74b85b" />
        <g class="head">
          <path d="M33 38 13 25l13 24z" fill="#5c9d46" />
          <path d="M83 38l21-13-12 24z" fill="#5c9d46" />
          <ellipse cx="58" cy="44" rx="28" ry="27" fill="#74b85b" />
          <path
            d="M48 20q4-14 10-2 3-12 10 1 6-9 7 4"
            stroke="#6b3f1d"
            stroke-width="4"
            fill="none"
            stroke-linecap="round"
          />
          <g class="eyes-open">
            <circle cx="50" cy="40" r="7.5" fill="#fff" />
            <circle cx="70" cy="40" r="7.5" fill="#fff" />
            <circle cx="53" cy="41" r="3.8" fill="#1f2a44" />
            <circle cx="73" cy="41" r="3.8" fill="#1f2a44" />
            <circle cx="54.5" cy="39.5" r="1.2" fill="#fff" />
            <circle cx="74.5" cy="39.5" r="1.2" fill="#fff" />
          </g>
          <g class="eyes-shut" stroke="#1f2a44" stroke-width="3" fill="none" stroke-linecap="round">
            <path d="M44 42q6 5 12 0" />
            <path d="M64 42q6 5 12 0" />
          </g>
          <g class="brows" stroke="#3b5f2b" stroke-width="3.5" stroke-linecap="round">
            <path d="M43 30l13 4" />
            <path d="M77 30l-13 4" />
          </g>
          <ellipse cx="72" cy="54" rx="12" ry="9" fill="#5f9c48" />
          <ellipse cx="76" cy="51" rx="3.5" ry="2.5" fill="#8fd174" />
          <path
            d="M46 63q14 9 28 0"
            stroke="#2f4f24"
            stroke-width="3"
            fill="none"
            stroke-linecap="round"
          />
          <path d="M52 66v-5l5 1z" fill="#fffbea" />
          <circle cx="40" cy="54" r="4" fill="#f29b9b" opacity="0.6" />
        </g>
      </g>
    </svg>
  `,
})
export class WallTroll {
  readonly asleep = input(false);
  readonly bonking = input(false);
  readonly cheering = input(false);
  readonly angry = input(false);
}
