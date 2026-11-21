import { Component, computed, input } from '@angular/core';
import { FRIEND_LOOKS, FriendKind } from './picnic-friends';

/** A friend's flat face in its own colours, for the plates, the blankets and the collection. */
@Component({
  selector: 'app-picnic-face',
  template: `<svg viewBox="0 0 40 40" aria-hidden="true">
    @switch (look().ears) {
      @case ('long') {
        <ellipse cx="13" cy="9" rx="4" ry="9" [attr.fill]="look().fur" />
        <ellipse cx="27" cy="9" rx="4" ry="9" [attr.fill]="look().fur" />
        <ellipse cx="13" cy="10" rx="2" ry="6" [attr.fill]="look().dark" opacity="0.6" />
        <ellipse cx="27" cy="10" rx="2" ry="6" [attr.fill]="look().dark" opacity="0.6" />
      }
      @case ('round') {
        <circle cx="9" cy="12" r="6" [attr.fill]="look().fur" />
        <circle cx="31" cy="12" r="6" [attr.fill]="look().fur" />
        <circle cx="9" cy="12" r="3" [attr.fill]="look().dark" opacity="0.7" />
        <circle cx="31" cy="12" r="3" [attr.fill]="look().dark" opacity="0.7" />
      }
      @case ('pointy') {
        <path d="M6 18 9 3 18 12z" [attr.fill]="look().fur" />
        <path d="M34 18 31 3 22 12z" [attr.fill]="look().fur" />
        <path d="M9 7 10 13 14 12z" [attr.fill]="look().dark" />
        <path d="M31 7 30 13 26 12z" [attr.fill]="look().dark" />
      }
      @case ('tufts') {
        <path d="M7 15 8 4 16 11z" [attr.fill]="look().fur" />
        <path d="M33 15 32 4 24 11z" [attr.fill]="look().fur" />
      }
      @case ('tiny') {
        <circle cx="10" cy="11" r="3.5" [attr.fill]="look().dark" />
        <circle cx="30" cy="11" r="3.5" [attr.fill]="look().dark" />
      }
    }
    @if (kind() === 'hedgehog') {
      <path
        d="M3 24 6 12 10 16 13 6 17 12 20 3 23 12 27 6 30 16 34 12 37 24z"
        [attr.fill]="look().dark"
      />
    }
    <circle cx="20" cy="23" r="14" [attr.fill]="look().fur" />
    @if (kind() === 'badger') {
      <path d="M17 9h6v28h-6z" [attr.fill]="look().light" />
      <path
        d="M10 14q-2 8 2 14M30 14q2 8-2 14"
        [attr.stroke]="look().dark"
        stroke-width="4"
        fill="none"
      />
    }
    @if (kind() === 'lamb') {
      <circle cx="13" cy="12" r="5" fill="#fffdf8" />
      <circle cx="20" cy="10" r="5" fill="#fffdf8" />
      <circle cx="27" cy="12" r="5" fill="#fffdf8" />
    }
    <ellipse cx="20" cy="29" rx="8" ry="6" [attr.fill]="look().light" />
    @if (look().snout === 'beak') {
      <path d="M15 26h10l-5 6z" [attr.fill]="look().dark" />
    } @else if (look().snout === 'wide') {
      <path d="M12 29q8 6 16 0" stroke="#2f3a2a" stroke-width="1.8" fill="none" />
    } @else {
      <ellipse cx="20" cy="26.5" rx="2.4" ry="1.8" fill="#2a1d16" />
      <path d="M17.5 30q2.5 2 5 0" stroke="#2a1d16" stroke-width="1.3" fill="none" />
    }
    @if (kind() === 'frog') {
      <circle cx="13" cy="12" r="5.5" [attr.fill]="look().fur" />
      <circle cx="27" cy="12" r="5.5" [attr.fill]="look().fur" />
      <circle cx="13" cy="12" r="2.4" fill="#1e140d" />
      <circle cx="27" cy="12" r="2.4" fill="#1e140d" />
    } @else if (kind() === 'owl') {
      <circle cx="14" cy="20" r="5" fill="#fff6e0" />
      <circle cx="26" cy="20" r="5" fill="#fff6e0" />
      <circle cx="14" cy="20" r="2.4" fill="#1e140d" />
      <circle cx="26" cy="20" r="2.4" fill="#1e140d" />
    } @else {
      <circle cx="14.5" cy="20" r="2.2" fill="#1e140d" />
      <circle cx="25.5" cy="20" r="2.2" fill="#1e140d" />
      <circle cx="15.2" cy="19.2" r="0.7" fill="#fff" />
      <circle cx="26.2" cy="19.2" r="0.7" fill="#fff" />
    }
    <circle cx="10.5" cy="26" r="2.4" fill="#f29a8f" opacity="0.55" />
    <circle cx="29.5" cy="26" r="2.4" fill="#f29a8f" opacity="0.55" />
  </svg>`,
  styles: `
    :host {
      display: inline-block;
      width: 32px;
      height: 32px;
      flex: none;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
  `,
})
export class PicnicFace {
  readonly kind = input.required<FriendKind>();
  protected readonly look = computed(() => FRIEND_LOOKS[this.kind()]);
}
