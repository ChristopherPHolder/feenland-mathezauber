import {
  answer,
  createRace,
  finalSparkles,
  isMastered,
  playerPlace,
  racer,
  raceStars,
  STUMBLE_MS,
  tick,
  TRACK_LENGTH,
} from './race';
const fixed = () => 0.5;
function run(state: ReturnType<typeof createRace>, ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) state = tick(state, 100, fixed);
  return state;
}
describe('unicorn race engine', () => {
  it('starts everyone at the line with the rivals ready to run', () => {
    const race = createRace('normal', 1);
    expect(race.racers.map((racer) => racer.position)).toEqual([0, 0, 0, 0]);
    expect(racer(race, 'player').speed).toBe(0);
    expect(racer(race, 'cloud').speed).toBeGreaterThan(racer(race, 'peach').speed);
    expect(playerPlace(race)).toBe(1);
  });
  it('speeds the unicorn up with each right answer and sprints her forward', () => {
    let race = createRace('normal', 1);
    race = run(answer(race, true, fixed), 1000);
    const afterOne = racer(race, 'player');
    expect(afterOne.position).toBeGreaterThan(2.5);
    race = run(answer(race, true, fixed), 1000);
    const afterTwo = racer(race, 'player');
    expect(afterTwo.target).toBeGreaterThan(afterOne.target);
    expect(race.correct).toBe(2);
    expect(race.sparkles).toBe(20);
  });
  it('makes a wrong answer a stumble that halves the pace and stops her for a moment', () => {
    let race = createRace('normal', 1);
    for (let n = 0; n < 4; n++) race = answer(race, true, fixed);
    race = run(race, 2000);
    const before = racer(race, 'player');
    race = answer(race, false, fixed);
    expect(race.stumbleMs).toBe(STUMBLE_MS);
    expect(race.streak).toBe(0);
    expect(race.mistakes).toBe(1);
    expect(racer(race, 'player').target).toBeCloseTo(before.target / 2);
    const stuck = tick(race, 100, fixed);
    expect(racer(stuck, 'player').position).toBe(before.position);
  });
  it('turns three in a row into a rainbow dash worth more sparkles', () => {
    let race = createRace('off', 1);
    race = answer(race, true, fixed);
    race = answer(race, true, fixed);
    expect(race.sparkles).toBe(20);
    race = answer(race, true, fixed);
    expect(race.streak).toBe(3);
    expect(race.sparkles).toBe(40);
    expect(racer(race, 'player').dash).toBeGreaterThan(8 * 3);
  });
  it('only moves the rivals when the child answers in a no-rush race', () => {
    let race = createRace('off', 2);
    race = run(race, 5000);
    expect(race.racers.every((racer) => racer.position === 0)).toBe(true);
    race = run(answer(race, false, fixed), 2000);
    expect(racer(race, 'player').position).toBe(0);
    expect(racer(race, 'cloud').position).toBeGreaterThan(0);
  });
  it('finishes when the unicorn crosses the line and ranks her by who got there first', () => {
    let race = createRace('relaxed', 1);
    for (let n = 0; n < 12 && !race.done; n++) race = run(answer(race, true, fixed), 1500);
    expect(race.done).toBe(true);
    expect(racer(race, 'player').position).toBe(TRACK_LENGTH);
    expect(playerPlace(race)).toBe(1);
    expect(finalSparkles(race)).toBe(race.sparkles + 50);
    const later = tick(race, 100, fixed);
    expect(later).toBe(race);
  });
  it('lets a slow racer get overtaken and finish behind the rivals', () => {
    let race = createRace('fast', 1);
    race = run(race, 40000);
    expect(race.done).toBe(false);
    expect(playerPlace(race)).toBe(4);
    for (let n = 0; n < 30 && !race.done; n++) race = run(answer(race, true, fixed), 400);
    expect(race.done).toBe(true);
    expect(playerPlace(race)).toBe(4);
  });
  it('awards stars by place and requires a win for the castle cup', () => {
    expect(raceStars(1)).toBe(3);
    expect(raceStars(2)).toBe(2);
    expect(raceStars(3)).toBe(1);
    expect(raceStars(4)).toBe(1);
    expect(isMastered(2, 1)).toBe(true);
    expect(isMastered(3, 1)).toBe(false);
    expect(isMastered(2, 5)).toBe(false);
    expect(isMastered(1, 5)).toBe(true);
  });
});
