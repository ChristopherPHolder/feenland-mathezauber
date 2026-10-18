/** Rendering and audio never determine the outcome of a turn. */
export interface Encounter {
  readonly energy: number;
  readonly appearance: string;
}
export const WAVE_ONE: readonly Encounter[] = [
  { energy: 9, appearance: 'monster-red' },
  { energy: 8, appearance: 'monster-blue' },
];
export type Phase = 'ready' | 'casting' | 'wrong' | 'transforming' | 'lost' | 'complete';
export interface Battle {
  readonly encounter: number;
  readonly hearts: number;
  readonly mistakes: number;
  readonly phase: Phase;
  readonly spell: number | null;
  readonly damaged: boolean;
}
export const freshBattle = (): Battle => ({
  encounter: 0,
  hearts: 3,
  mistakes: 0,
  phase: 'ready',
  spell: null,
  damaged: false,
});
export function cast(state: Battle, spell: number): Battle {
  if (state.phase !== 'ready' || !Number.isInteger(spell) || spell < 1 || spell > 5) return state;
  return { ...state, spell, damaged: false, phase: 'casting' };
}
export function resolveSpell(state: Battle, encounters = WAVE_ONE): Battle {
  if (state.phase !== 'casting') return state;
  if (encounters[state.encounter].energy + (state.spell ?? 0) === 10)
    return { ...state, phase: 'transforming' };
  const damaged = state.mistakes === 2;
  const hearts = state.hearts - Number(damaged);
  return {
    ...state,
    mistakes: damaged ? 0 : state.mistakes + 1,
    hearts,
    damaged,
    phase: hearts === 0 ? 'lost' : 'wrong',
  };
}
export function advance(state: Battle, encounters = WAVE_ONE): Battle {
  if (state.phase === 'wrong') return { ...state, phase: 'ready' };
  if (state.phase !== 'transforming') return state;
  if (state.encounter + 1 === encounters.length) return { ...state, hearts: 3, phase: 'complete' };
  return { ...freshBattle(), hearts: state.hearts, encounter: state.encounter + 1 };
}
