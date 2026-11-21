import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  linkedSignal,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { LocaleService } from '../../../core/locale';
import { ThreeStage, WorldLoader } from '../../../shared/three/three-stage';
import {
  cleanName,
  coatIds,
  COATS,
  CoatId,
  hasHorn,
  Horse,
  HorseKind,
  horseKinds,
  hornIds,
  HORNS,
  HornId,
  maneIds,
  MANES,
  ManeId,
  Marking,
  markings,
  NAME_MAX,
  randomHorse,
  SpecialId,
  specialPrice,
} from '../horse';
import { RaceSounds } from '../race-sounds';
import { cupTitleKey, outfitEmblem, outfitNameKey } from '../outfits';
import { raceText } from '../race-messages';
import { Outfit, OUTFIT_CUP, outfits, RaceStore } from '../race-store';
import { RacerArt } from '../racer-art';
import { NAME_IDEAS, StableMessageKey, stableText } from './stable-messages';
import type { StableState } from './stable-world';

type Tab = 'name' | 'kind' | 'coat' | 'mane' | 'marking' | 'dress';
const TABS: readonly { readonly id: Tab; readonly icon: string; readonly key: StableMessageKey }[] =
  [
    { id: 'name', icon: '✏️', key: 'tabName' },
    { id: 'kind', icon: '🦄', key: 'tabKind' },
    { id: 'coat', icon: '🎨', key: 'tabCoat' },
    { id: 'mane', icon: '🌈', key: 'tabMane' },
    { id: 'marking', icon: '⭐', key: 'tabMarking' },
    { id: 'dress', icon: '👑', key: 'tabDress' },
  ];
/** How many name ideas show at once; "more names" moves on to the next handful. */
const IDEAS_SHOWN = 5;
const loadWorld: WorldLoader<StableState> = () =>
  import('./stable-world').then((m) => m.StableWorld);
const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * The Stable: where a child makes the horse they race with. The horse stands on a 3D stand
 * (the 2D side view without WebGL) and changes the moment an option is tapped; every change is
 * saved straight away, so leaving by any way out keeps it. One screen, no scrolling: the stand
 * on top or on the left, then tabs, the active tab's options and Done.
 */
@Component({
  selector: 'app-horse-stable',
  imports: [ThreeStage, RacerArt],
  templateUrl: './horse-stable.html',
  styleUrl: './horse-stable.css',
})
export class HorseStable {
  protected readonly i = inject(LocaleService);
  private readonly store = inject(RaceStore);
  private readonly sounds = inject(RaceSounds);
  readonly done = output<void>();
  protected readonly tabs = TABS;
  protected readonly kinds = horseKinds;
  protected readonly coats = coatIds;
  protected readonly manes = maneIds;
  protected readonly markings = markings;
  protected readonly horns = hornIds;
  protected readonly hornPaint = HORNS;
  protected readonly outfits = outfits;
  protected readonly coatPaint = COATS;
  protected readonly nameMax = NAME_MAX;
  protected readonly loadWorld = loadWorld;
  protected readonly tab = signal<Tab>('name');
  protected readonly horse = computed(() => this.store.save().horse);
  /** A sparkle special being tried on before it is bought; the horse shows it meanwhile. */
  protected readonly trying = signal<Partial<Pick<Horse, 'coat' | 'mane'>> | null>(null);
  /** The horse as it looks right now, with anything being tried on. */
  protected readonly shown = computed<Horse>(() => ({ ...this.horse(), ...this.trying() }));
  protected readonly tryingId = computed<SpecialId | null>(() => {
    const trying = this.trying();
    if (trying?.coat) return `coat:${trying.coat}`;
    if (trying?.mane) return `mane:${trying.mane}`;
    return null;
  });
  protected readonly tryingPrice = computed(() => {
    const id = this.tryingId();
    return id ? (specialPrice(id) ?? 0) : 0;
  });
  protected readonly balance = computed(() => {
    this.store.save();
    return this.store.balance();
  });
  protected readonly affordable = computed(() => this.balance() >= this.tryingPrice());
  /** How far the child has turned the stand by dragging, in radians. */
  private readonly spin = signal(0);
  private dragFrom: number | null = null;
  protected readonly defaultName = computed(() => raceText(this.i.locale(), 'racerPlayer'));
  protected readonly shownName = computed(() => this.horse().name || this.defaultName());
  protected readonly horned = computed(() => hasHorn(this.shown().kind));
  protected readonly outfit = computed(() => this.store.save().outfit);
  /** What is in the name field; the store keeps it tidied, this keeps the spaces being typed. */
  protected readonly nameDraft = linkedSignal<string, string>({
    source: () => this.horse().name,
    computation: (name, previous) =>
      previous && cleanName(previous.value) === name ? previous.value : name,
  });
  private readonly ideasFrom = signal(0);
  protected readonly ideas = computed(() => {
    const names = NAME_IDEAS[this.i.locale()];
    const from = this.ideasFrom() % names.length;
    return Array.from({ length: IDEAS_SHOWN }, (_, n) => names[(from + n) % names.length]);
  });
  private readonly hop = signal(0);
  protected readonly world = computed<StableState>(() => ({
    horse: this.shown(),
    outfit: this.store.save().outfit,
    hop: this.hop(),
    spin: this.spin(),
  }));
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  constructor() {
    afterNextRender(() => this.heading().nativeElement.focus({ preventScroll: true }));
  }

  protected s(key: StableMessageKey, values: Record<string, string> = {}): string {
    return stableText(this.i.locale(), key, values);
  }
  protected kindKey(kind: HorseKind): StableMessageKey {
    return `kind${capital(kind)}` as StableMessageKey;
  }
  protected coatKey(coat: CoatId): StableMessageKey {
    return `coat${capital(coat)}` as StableMessageKey;
  }
  protected maneKey(mane: ManeId): StableMessageKey {
    return `mane${capital(mane)}` as StableMessageKey;
  }
  protected markingKey(marking: Marking): StableMessageKey {
    return `marking${capital(marking)}` as StableMessageKey;
  }
  protected hornKey(horn: HornId): StableMessageKey {
    return `horn${capital(horn)}` as StableMessageKey;
  }
  /** A horn swatch: its colour with the groove as a ring. */
  protected hornFill(horn: HornId): string {
    const [colour, groove] = HORNS[horn];
    return `repeating-linear-gradient(135deg, ${colour} 0 7px, ${groove} 7px 9px)`;
  }
  /** Race texts (keepsake names, "Just Lumi") with the horse's name filled in. */
  protected r(key: Parameters<typeof raceText>[1], values: Record<string, string> = {}) {
    return raceText(this.i.locale(), key, { name: this.shownName(), ...values });
  }
  protected outfitName(outfit: Outfit | null) {
    return this.r(outfitNameKey(outfit));
  }
  protected outfitEmblem(outfit: Outfit): string {
    return outfitEmblem(outfit);
  }
  protected outfitLocked(outfit: Outfit): string {
    return this.r('outfitLocked', {
      name: this.r(outfitNameKey(outfit)),
      cup: this.r(cupTitleKey(OUTFIT_CUP[outfit])),
    });
  }
  protected earned(outfit: Outfit): boolean {
    this.store.save();
    return this.store.earned(outfit);
  }
  protected wear(outfit: Outfit | null) {
    this.store.wear(outfit);
    this.react('pick');
  }
  /** The horse as it would look with another marking, for the pictures on the marking options. */
  protected withMarking(marking: Marking): Horse {
    return { ...this.shown(), marking };
  }
  /** The horse hops and the Stable chimes for every change. */
  private react(sound: 'pick' | 'buy') {
    this.hop.update((hop) => hop + 1);
    this.sounds.unlock();
    this.sounds.play(sound);
  }
  /** A round swatch striped in a mane's three colours. */
  protected maneFill(mane: ManeId): string {
    const [a, b, c] = MANES[mane];
    return `conic-gradient(${a} 0 33.3%, ${b} 0 66.6%, ${c} 0)`;
  }
  /** The horse as it would look as another kind, for the pictures on the kind options. */
  protected asKind(kind: HorseKind): Horse {
    return { ...this.shown(), kind };
  }
  protected coatSpecial(coat: CoatId): SpecialId {
    return `coat:${coat}`;
  }
  protected maneSpecial(mane: ManeId): SpecialId {
    return `mane:${mane}`;
  }
  /** The price of a special not bought yet, or nothing for a free or owned one. */
  protected price(id: SpecialId): number | undefined {
    this.store.save();
    return this.store.owns(id) ? undefined : specialPrice(id);
  }
  protected specialLabel(name: string, id: SpecialId): string {
    const price = this.price(id);
    return price === undefined ? name : this.s('priced', { name, n: this.i.format(price) });
  }
  /** Changes a part; a special not bought yet is tried on instead, with the buy bar showing. */
  protected change(part: Partial<Omit<Horse, 'name'>>) {
    const special: SpecialId | null = part.coat
      ? `coat:${part.coat}`
      : part.mane
        ? `mane:${part.mane}`
        : null;
    if (special && this.price(special) !== undefined) {
      this.trying.set(part.coat ? { coat: part.coat } : { mane: part.mane });
    } else {
      this.trying.set(null);
      this.store.setHorse({ ...this.horse(), ...part });
    }
    this.react('pick');
  }
  protected buy() {
    const id = this.tryingId();
    const trying = this.trying();
    if (!id || !trying || !this.store.buy(id)) return;
    this.store.setHorse({ ...this.horse(), ...trying });
    this.trying.set(null);
    this.react('buy');
  }
  protected stopTrying() {
    this.trying.set(null);
  }
  protected finish() {
    this.trying.set(null);
    this.done.emit();
  }
  protected chooseTab(tab: Tab) {
    this.trying.set(null);
    this.tab.set(tab);
  }
  /** Dragging across the stand turns it; the buttons on top of it keep their taps. */
  protected dragStart(event: PointerEvent) {
    if ((event.target as Element).closest('button')) return;
    this.dragFrom = event.clientX;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }
  protected dragMove(event: PointerEvent) {
    if (this.dragFrom === null) return;
    this.spin.update((spin) => spin + (event.clientX - this.dragFrom!) * 0.012);
    this.dragFrom = event.clientX;
  }
  protected dragEnd() {
    this.dragFrom = null;
  }
  protected typeName(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.nameDraft.set(value);
    const name = cleanName(value);
    if (name !== this.horse().name) this.store.setHorse({ ...this.horse(), name });
  }
  protected pickName(name: string) {
    this.nameDraft.set(name);
    this.store.setHorse({ ...this.horse(), name });
    this.react('pick');
  }
  protected moreNames() {
    this.ideasFrom.update((from) => from + IDEAS_SHOWN);
  }
  /** A new look from the free colours and the specials already bought. */
  protected surprise() {
    const owned = this.store.save().owned;
    let next = randomHorse(this.horse().name, Math.random, owned);
    // A surprise must look different from what is there.
    for (let tries = 0; tries < 5 && this.looksSame(next); tries++)
      next = randomHorse(this.horse().name, Math.random, owned);
    this.change(next);
  }
  /** Tabs follow the ARIA pattern: arrows, Home and End move and select at once. */
  protected tabKey(event: KeyboardEvent, index: number) {
    const last = TABS.length - 1;
    const target =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    this.chooseTab(TABS[target].id);
    this.tabButtons()[target]?.nativeElement.focus();
  }
  private looksSame(horse: Horse): boolean {
    const now = this.horse();
    return (
      horse.kind === now.kind &&
      horse.coat === now.coat &&
      horse.mane === now.mane &&
      horse.marking === now.marking
    );
  }
}
