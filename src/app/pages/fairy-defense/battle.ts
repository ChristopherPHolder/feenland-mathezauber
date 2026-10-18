import { practiceSpells } from './practice-battle';
import { createWave, Wave } from './waves';
export type { Encounter } from './waves';
export const WAVE_ONE = createWave(1).encounters;
export type Phase = 'ready' | 'casting' | 'wrong' | 'transforming' | 'lost' | 'complete';
export interface Battle {
  readonly wave: Wave;
  readonly encounter: number;
  readonly hearts: number;
  readonly mistakes: number;
  readonly attempts: number;
  readonly hintVisible: boolean;
  readonly helpUsed: boolean;
  readonly independent: readonly boolean[];
  readonly phase: Phase;
  readonly spell: number | null;
  readonly damaged: boolean;
}
export const freshBattle = (number = 1): Battle => ({
  wave: createWave(number),
  encounter: 0,
  hearts: 3,
  mistakes: 0,
  attempts: 0,
  hintVisible: number <= 4,
  helpUsed: number <= 4,
  independent: [],
  phase: 'ready',
  spell: null,
  damaged: false,
});
export function revealHint(state: Battle): Battle {
  return state.phase === 'ready' ? { ...state, hintVisible: true, helpUsed: true } : state;
}
export function cast(state: Battle, spell: number): Battle {
  const question = state.wave.encounters[state.encounter].question;
  if (
    state.phase !== 'ready' ||
    !(question ? practiceSpells(question.answer) : state.wave.spells).includes(spell)
  )
    return state;
  return { ...state, spell, attempts: state.attempts + 1, damaged: false, phase: 'casting' };
}
export function resolveSpell(state: Battle): Battle {
  if (state.phase !== 'casting') return state;
  const encounter = state.wave.encounters[state.encounter];
  if (
    encounter.question
      ? state.spell === encounter.question.answer
      : encounter.energy + (state.spell ?? 0) === 10
  )
    return {
      ...state,
      phase: 'transforming',
      independent: [...state.independent, state.attempts === 1 && !state.helpUsed],
    };
  const damaged = state.mistakes === 2;
  const hearts = state.hearts - Number(damaged);
  return {
    ...state,
    mistakes: damaged ? 0 : state.mistakes + 1,
    hearts,
    damaged,
    hintVisible: true,
    helpUsed: true,
    phase: hearts === 0 ? 'lost' : 'wrong',
  };
}
export function advance(state: Battle): Battle {
  if (state.phase === 'wrong') return { ...state, phase: 'ready' };
  if (state.phase !== 'transforming') return state;
  if (state.encounter + 1 === state.wave.encounters.length)
    return { ...state, hearts: 3, phase: 'complete' };
  return {
    ...state,
    encounter: state.encounter + 1,
    mistakes: 0,
    attempts: 0,
    hintVisible: state.wave.assistance === 'guided',
    helpUsed: state.wave.assistance === 'guided',
    spell: null,
    damaged: false,
    phase: 'ready',
  };
}
