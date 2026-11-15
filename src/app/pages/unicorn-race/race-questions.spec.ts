import {
  CHOICES,
  cupTracks,
  heats,
  raceCups,
  raceLevelEntries,
  raceQuestion,
  raceStage,
  RaceSkill,
  raceSumText,
  RaceStage,
  stageFor,
  raceTracks,
  trackAfter,
  trackPosition,
} from './race-questions';
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
/** Works the sum out; a missing-number question is solved for its question mark. */
function evaluate(text: string): number {
  const half = /^half of (\d+)$/.exec(text);
  if (half) return Number(half[1]) / 2;
  const apply = (left: number, op: string, right: number) =>
    op === '+'
      ? left + right
      : op === '−'
        ? left - right
        : op === '÷'
          ? left / right
          : left * right;
  const [lhs, rhs] = text.split(' = ');
  const [a, op, b] = lhs.split(' ');
  if (rhs === undefined) return apply(Number(a), op, Number(b));
  const result = Number(rhs);
  const known = Number(a === '?' ? b : a);
  if (op === '+') return result - known;
  if (op === '×') return result / known;
  // a − ? = result
  return Number(a) - result;
}
describe('race questions', () => {
  it('lists twenty-two open races in five cups, easiest first, with stable ids', () => {
    expect(raceLevelEntries.map((level) => level.id)).toEqual(
      [16, 1, 2, 3, 4, 20, 17, 5, 6, 7, 8, 21, 9, 18, 10, 11, 19, 22, 12, 13, 14, 15].map(
        (n) => `unicorn-race-${n}`,
      ),
    );
    expect(raceStage('unicorn-race-7')?.skill).toBe('easyTimes');
    expect(raceStage('unicorn-race-16')?.skill).toBe('bonds10');
    expect(raceStage('unicorn-race-20')?.skill).toBe('halves');
    expect(raceStage('unicorn-race-21')?.skill).toBe('shareEasy');
    expect(raceStage('unicorn-race-22')?.skill).toBe('shareHard');
    expect(raceStage('unicorn-race-23')).toBeUndefined();
    expect(raceStage('crocodile-1')).toBeUndefined();
    expect(raceCups.map((cup) => cupTracks(cup).length)).toEqual([4, 5, 5, 5, 3]);
    // Cups stay in order: every track of a cup comes before the next cup's tracks.
    expect(raceTracks.map((track) => raceCups.indexOf(track.cup))).toEqual(
      raceTracks.map((track) => raceCups.indexOf(track.cup)).sort(),
    );
    expect(trackPosition(16)).toBe(1);
    expect(trackAfter(16)).toBe(1);
    expect(trackAfter(4)).toBe(20);
    expect(trackAfter(8)).toBe(21);
    expect(trackAfter(19)).toBe(22);
    expect(trackAfter(22)).toBe(12);
    expect(trackPosition(20)).toBe(6);
    expect(trackAfter(15)).toBeUndefined();
    // Every track runs six heats: two chases, one shadow run and three races, the last a final.
    expect(heats.map((heat) => heat.mode)).toEqual([
      'race',
      'chase',
      'shadow',
      'race',
      'chase',
      'race',
    ]);
    expect(heats[5].final).toBe(true);
    // Later tracks are longer, so a race grows with the child.
    expect(raceTracks.at(-1)!.length).toBeGreaterThan(raceTracks[0].length);
  });
  it.each<[RaceSkill, (answer: number, text: string) => boolean]>([
    ['bonds10', (answer, text) => answer >= 1 && answer <= 9 && text.endsWith('= 10')],
    ['plus10', (answer, text) => answer <= 10 && text.includes('+')],
    ['crossTen', (answer) => answer >= 2 && answer <= 18],
    ['times6789', (answer, text) => answer <= 100 && text.includes('×')],
    ['twoDigitCarry', (answer) => answer >= 10 && answer <= 99],
    ['minus10', (answer, text) => answer >= 1 && answer <= 9 && text.includes('−')],
    ['plusMinus20', (answer) => answer >= 1 && answer <= 20],
    ['doubles', (answer, text) => answer <= 20 && text.includes('+')],
    ['plusMinus100', (answer) => answer >= 1 && answer <= 100],
    ['twoDigit', (answer) => answer >= 1 && answer <= 99],
    ['easyTimes', (answer, text) => answer <= 30 && text.includes('×')],
    ['times34', (answer, text) => answer <= 30 && text.includes('×')],
    ['missingFactor', (answer, text) => answer >= 2 && answer <= 10 && text.includes('?')],
    ['missingAddend', (answer, text) => answer >= 1 && answer <= 80 && text.includes('?')],
    ['hardTimes', (answer, text) => answer <= 30 && text.includes('×')],
    ['mixed', (answer) => answer >= 1 && answer <= 100],
    ['halves', (answer, text) => answer >= 2 && answer <= 50 && text.startsWith('half of ')],
    ['shareEasy', (answer, text) => answer >= 2 && answer <= 10 && text.includes('÷')],
    ['shareHard', (answer, text) => answer >= 2 && answer <= 10 && text.includes('÷')],
  ])('keeps %s questions in range with four distinct choices', (skill, inRange) => {
    const random = seeded(7);
    for (let n = 0; n < 200; n++) {
      const question = raceQuestion(skill, random);
      expect(evaluate(question.text)).toBe(question.answer);
      expect(inRange(question.answer, question.text), question.text).toBe(true);
      expect(question.choices).toHaveLength(CHOICES);
      expect(new Set(question.choices).size).toBe(CHOICES);
      expect(question.choices).toContain(question.answer);
      expect(question.choices.every((choice) => choice >= 0)).toBe(true);
    }
  });
  it('keeps easy times tables in the 2, 5 and 10 rows', () => {
    const random = seeded(3);
    for (let n = 0; n < 100; n++) {
      const [a, , b] = raceQuestion('easyTimes', random).text.split(' ');
      expect([a, b].some((factor) => ['2', '5', '10'].includes(factor))).toBe(true);
    }
  });
  it('keeps hard times tables out of the easy rows and two-digit sums free of carrying', () => {
    const random = seeded(5);
    for (let n = 0; n < 100; n++) {
      const [a, , b] = raceQuestion('hardTimes', random).text.split(' ');
      expect([a, b].includes('2') || [a, b].includes('5') || [a, b].includes('10')).toBe(false);
      const [left, op, right] = raceQuestion('twoDigit', random).text.split(' ');
      const [tensA, onesA] = [Math.floor(Number(left) / 10), Number(left) % 10];
      const [tensB, onesB] = [Math.floor(Number(right) / 10), Number(right) % 10];
      if (op === '+') expect(onesA + onesB).toBeLessThan(10);
      else {
        expect(onesA).toBeGreaterThan(onesB);
        expect(tensA).toBeGreaterThan(tensB);
      }
    }
  });
  it('makes every crossing question cross a ten', () => {
    const random = seeded(9);
    for (let n = 0; n < 200; n++) {
      for (const skill of ['crossTen', 'twoDigitCarry'] as const) {
        const [left, op, right] = raceQuestion(skill, random).text.split(' ');
        const [a, b] = [Number(left), Number(right)];
        if (op === '+') expect((a % 10) + (b % 10)).toBeGreaterThanOrEqual(10);
        else expect(a % 10).toBeLessThan(b % 10);
      }
      const [a, , b] = raceQuestion('times6789', random).text.split(' ');
      expect(['6', '7', '8', '9'].includes(a!) || ['6', '7', '8', '9'].includes(b!)).toBe(true);
    }
  });
  it('only shares exactly: whole answers, the right divisors, dividends up to 100', () => {
    const random = seeded(13);
    for (let n = 0; n < 200; n++) {
      for (const [skill, divisors] of [
        ['shareEasy', [2, 5, 10]],
        ['shareHard', [3, 4, 5, 6, 7, 8, 9]],
      ] as const) {
        const { text, answer } = raceQuestion(skill, random);
        const [dividend, , divisor] = text.split(' ').map(Number);
        expect(divisors).toContain(divisor);
        expect(dividend).toBeLessThanOrEqual(100);
        expect(dividend % divisor).toBe(0);
        expect(Number.isInteger(answer)).toBe(true);
      }
    }
  });
  it('halves only even numbers up to 100, from doubles to whole tens', () => {
    const random = seeded(17);
    const seen = new Set<number>();
    for (let n = 0; n < 300; n++) {
      const { text, answer } = raceQuestion('halves', random);
      const whole = Number(text.replace('half of ', ''));
      expect(whole % 2).toBe(0);
      expect(whole).toBeLessThanOrEqual(100);
      expect(answer * 2).toBe(whole);
      seen.add(whole);
    }
    // Small doubles undone, whole tens and two-digit halves all turn up.
    expect([...seen].some((whole) => whole <= 20)).toBe(true);
    expect([...seen].some((whole) => whole % 10 === 0 && whole > 20)).toBe(true);
    expect([...seen].some((whole) => whole % 10 !== 0 && whole > 20)).toBe(true);
  });
  it('shows halves in the child’s language and leaves other sums alone', () => {
    const halfOf = (n: string) => `die Hälfte von ${n}`;
    expect(raceSumText('half of 18', halfOf)).toBe('die Hälfte von 18');
    expect(raceSumText('35 ÷ 5', halfOf)).toBe('35 ÷ 5');
  });
  it('offers near misses for sharing, never the answer twice', () => {
    const random = seeded(19);
    for (let n = 0; n < 200; n++) {
      const { answer, choices } = raceQuestion('shareHard', random);
      expect(choices.every((choice) => choice >= 1 && Math.abs(choice - answer) <= 3)).toBe(true);
    }
  });
  it('eases the rivals and the shadow on the slow sharing track only', () => {
    const sharing = raceTracks.find((track) => track.skill === 'shareHard')!;
    const carrying = raceTracks.find((track) => track.skill === 'twoDigitCarry')!;
    const [ease, plain] = [stageFor(sharing, 4), stageFor(carrying, 4)];
    expect(ease.rivals).toBeCloseTo(plain.rivals * 0.9);
    // Same track length, slower par: the shadow gives the slower maths more time.
    const perUnit = (stage: RaceStage) => stage.parMs! / stage.length;
    expect(perUnit(stageFor(sharing, 3))).toBeGreaterThan(perUnit(stageFor(carrying, 3)));
    expect(raceTracks.filter((track) => track.ease !== undefined)).toEqual([sharing]);
  });
  it('avoids asking the same question twice in a row', () => {
    const random = seeded(11);
    let previous = raceQuestion('plus10', random).text;
    for (let n = 0; n < 60; n++) {
      const next = raceQuestion('plus10', random, previous).text;
      expect(next).not.toBe(previous);
      previous = next;
    }
  });
});
