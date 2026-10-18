export const TOTAL_WAVES = 20;
export type Assistance = 'guided' | 'assisted' | 'independent';
export interface Encounter {
  readonly energy: number;
  readonly question?: import('../../core/practice').Question;
  readonly appearance: string;
}
export interface Wave {
  readonly number: number;
  readonly boss: boolean;
  readonly assistance: Assistance;
  readonly spells: readonly number[];
  readonly encounters: readonly Encounter[];
}
const energies: readonly (readonly number[])[] = [
  [9, 8],
  [7, 6, 8],
  [5, 9, 7],
  [6, 5, 8, 7],
  [9, 7, 5],
  [5, 6, 7, 8],
  [9, 5, 7, 6],
  [8, 6, 9, 5],
  [7, 8, 5, 9],
  [8, 6, 7, 5],
  [10, 0, 4, 6],
  [1, 9, 2, 8],
  [3, 7, 0, 10],
  [4, 6, 5, 2],
  [0, 3, 7, 10],
  [1, 4, 8, 10],
  [0, 2, 6, 9],
  [3, 5, 7, 1],
  [4, 8, 0, 6],
  [0, 2, 5, 8, 10],
];
export const waveSize = (number: number) => energies[number - 1]?.length ?? 0;
export function createWave(number: number, random = Math.random): Wave {
  if (!Number.isInteger(number) || number < 1 || number > TOTAL_WAVES)
    throw new RangeError('Invalid wave');
  const values = [...energies[number - 1]];
  if (number > 1)
    for (let index = values.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [values[index], values[other]] = [values[other], values[index]];
    }
  const appearances = ['monster-red', 'monster-blue', 'monster-green', 'monster-purple'];
  return {
    number,
    boss: number % 5 === 0,
    assistance: number <= 4 ? 'guided' : number <= 12 ? 'assisted' : 'independent',
    spells: Array.from(
      { length: number < 11 ? 5 : 11 },
      (_, index) => index + (number < 11 ? 1 : 0),
    ),
    encounters: values.map((energy, index) => ({
      energy,
      appearance:
        number % 5 === 0 ? 'boss' : appearances[(number + index - 1) % appearances.length],
    })),
  };
}
