import {
  answer,
  createRace,
  CRUISE,
  finalSparkles,
  isMastered,
  MAX_SPEED,
  playerPlace,
  racer,
  raceStars,
  standings,
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
  it('starts everyone at the line, already trotting', () => {
    const race = createRace('normal', 1);
    expect(race.racers.map((racer) => racer.position)).toEqual([0, 0, 0, 0]);
    expect(racer(race, 'player').speed).toBe(CRUISE);
    expect(racer(race, 'cloud').speed).toBeGreaterThan(racer(race, 'peach').speed);
    expect(playerPlace(race)).toBe(1);
  });
  it('keeps every racer moving on its own, even without an answer', () => {
    const race = run(createRace('normal', 1), 3000);
    for (const current of race.racers) expect(current.position).toBeGreaterThan(2);
    // The rivals run at different speeds, so they spread out instead of moving as one block.
    const positions = race.racers.map((racer) => racer.position);
    expect(new Set(positions.map((position) => position.toFixed(1))).size).toBe(4);
    expect(racer(race, 'cloud').position).toBeGreaterThan(racer(race, 'peach').position);
  });
  it('speeds the unicorn up with each right answer and sprints her forward', () => {
    let race = createRace('normal', 1);
    const idle = run(race, 1000);
    race = run(answer(race, true), 1000);
    const afterOne = racer(race, 'player');
    expect(afterOne.position).toBeGreaterThan(racer(idle, 'player').position + 2);
    race = run(answer(race, true), 1000);
    const afterTwo = racer(race, 'player');
    expect(afterTwo.target).toBeGreaterThan(afterOne.target);
    expect(afterTwo.speed).toBeGreaterThan(afterOne.speed);
    expect(race.correct).toBe(2);
    expect(race.sparkles).toBe(20);
  });
  it('caps the gallop so a long streak stays a race', () => {
    let race = createRace('normal', 1);
    for (let n = 0; n < 12; n++) race = answer(race, true);
    expect(racer(race, 'player').target).toBe(MAX_SPEED);
  });
  it('makes a wrong answer a stumble that slows her down and holds the pace for a moment', () => {
    let race = createRace('normal', 1);
    for (let n = 0; n < 4; n++) race = answer(race, true);
    race = run(race, 2000);
    const before = racer(race, 'player');
    race = answer(race, false);
    expect(race.stumbleMs).toBe(STUMBLE_MS);
    expect(race.streak).toBe(0);
    expect(race.mistakes).toBe(1);
    const stumbled = racer(race, 'player');
    expect(stumbled.target).toBeCloseTo(before.target * 0.55);
    expect(stumbled.speed).toBeLessThan(before.speed / 2);
    // She still creeps forward while stumbling, but far slower than before.
    const crept = racer(tick(race, 100, fixed), 'player');
    expect(crept.position).toBeGreaterThan(before.position);
    expect(crept.position - before.position).toBeLessThan((before.speed * 0.1) / 2);
    expect(crept.speed).toBe(stumbled.speed);
  });
  it('turns three in a row into a rainbow dash worth more sparkles', () => {
    let race = createRace('relaxed', 1);
    race = answer(race, true);
    race = answer(race, true);
    expect(race.sparkles).toBe(20);
    const beforeRainbow = racer(race, 'player');
    race = answer(race, true);
    expect(race.streak).toBe(3);
    expect(race.sparkles).toBe(40);
    expect(racer(race, 'player').dash - beforeRainbow.dash).toBeGreaterThan(2.5);
  });
  it('eases back toward a trot when no answer comes for a while', () => {
    let race = createRace('normal', 1);
    for (let n = 0; n < 5; n++) race = answer(race, true);
    const galloping = racer(run(race, 3000), 'player').target;
    const idle = racer(run(race, 15000), 'player').target;
    expect(idle).toBeLessThan(galloping);
    expect(idle).toBeGreaterThanOrEqual(CRUISE);
  });
  it('finishes when the unicorn crosses the line and ranks her by who got there first', () => {
    let race = createRace('relaxed', 1);
    for (let n = 0; n < 12 && !race.done; n++) race = run(answer(race, true), 1500);
    expect(race.done).toBe(true);
    expect(racer(race, 'player').position).toBe(TRACK_LENGTH);
    expect(playerPlace(race)).toBe(1);
    expect(finalSparkles(race)).toBe(race.sparkles + 50);
    const later = tick(race, 100, fixed);
    expect(later).toBe(race);
  });
  it('lets a slow racer get overtaken and finish behind the rivals', () => {
    let race = createRace('fast', 1);
    race = run(race, 50000);
    expect(race.done).toBe(false);
    expect(playerPlace(race)).toBe(4);
    for (let n = 0; n < 30 && !race.done; n++) race = run(answer(race, true), 400);
    expect(race.done).toBe(true);
    expect(playerPlace(race)).toBe(4);
  });
  it('lists the standings leader first', () => {
    let race = createRace('fast', 1);
    race = run(race, 20000);
    const order = standings(race);
    expect(order.map((entry) => entry.place)).toEqual([1, 2, 3, 4]);
    expect(order[0].id).toBe('cloud');
    expect(order[3].id).toBe('player');
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
