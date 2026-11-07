import {
  answer,
  createRace as createRaceFrom,
  CRUISE,
  finalSparkles,
  gapTo,
  HEAD_START,
  isMastered,
  MAX_SPEED,
  Pace,
  playerPlace,
  racer,
  raceStars,
  standings,
  STUMBLE_MS,
  tick,
} from './race';
import { RaceLevel, raceStages } from './race-questions';
const fixed = () => 0.5;
const stage = (level: RaceLevel) => raceStages.find((entry) => entry.stage === level)!;
const createRace = (pace: Pace, level: RaceLevel, bestMs?: number) =>
  createRaceFrom(pace, stage(level), bestMs);
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
    for (let n = 0; n < 40 && !race.done; n++) race = run(answer(race, true), 1500);
    expect(race.done).toBe(true);
    expect(racer(race, 'player').position).toBe(race.length);
    expect(playerPlace(race)).toBe(1);
    expect(finalSparkles(race)).toBe(race.sparkles + 50);
    const later = tick(race, 100, fixed);
    expect(later).toBe(race);
  });
  it('lets a slow racer get overtaken and finish behind the rivals', () => {
    let race = createRace('fast', 1);
    race = run(race, 90000);
    expect(race.done).toBe(false);
    expect(playerPlace(race)).toBe(4);
    for (let n = 0; n < 60 && !race.done; n++) race = run(answer(race, true), 400);
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
  it('makes a longer race last about a minute of steady answering', () => {
    let race = createRace('normal', 1);
    // One right answer every four seconds, the pace of a child who knows the facts.
    while (!race.done && race.elapsedMs < 300000) race = run(answer(race, true), 4000);
    expect(race.done).toBe(true);
    expect(race.elapsedMs).toBeGreaterThan(30000);
    expect(race.elapsedMs).toBeLessThan(90000);
    expect(race.correct).toBeGreaterThanOrEqual(9);
  });
  it('awards stars by place and requires a win for the castle cup', () => {
    const finish = (level: RaceLevel, holdMs: number) => {
      let race = createRace('normal', level);
      race = run(race, holdMs);
      for (let n = 0; n < 200 && !race.done; n++) race = run(answer(race, true), 300);
      return race;
    };
    const win = finish(1, 0);
    expect(playerPlace(win)).toBe(1);
    expect(raceStars(win)).toBe(3);
    expect(isMastered(win)).toBe(true);
    const late = finish(1, 120000);
    expect(playerPlace(late)).toBe(4);
    expect(raceStars(late)).toBe(1);
    expect(isMastered(late)).toBe(false);
    const finalLate = finish(12, 120000);
    expect(isMastered(finalLate)).toBe(false);
    let final = createRace('normal', 12);
    for (let n = 0; n < 200 && !final.done; n++) final = run(answer(final, true), 300);
    expect(playerPlace(final)).toBe(1);
    expect(isMastered(final)).toBe(true);
  });
  it('lines Lumi up against Storm with a head start in a chase and rewards catching him', () => {
    let race = createRace('normal', 2);
    expect(race.mode).toBe('chase');
    expect(race.racers.map((racer) => racer.id)).toEqual(['player', 'storm']);
    expect(racer(race, 'storm').position).toBe(Math.round(race.length * HEAD_START));
    expect(gapTo(race, 'storm')).toBe(Math.round(race.length * HEAD_START));
    expect(playerPlace(race)).toBe(2);
    for (let n = 0; n < 200 && !race.done; n++) race = run(answer(race, true), 300);
    expect(playerPlace(race)).toBe(1);
    expect(raceStars(race)).toBe(3);
    expect(isMastered(race)).toBe(true);
    let slow = createRace('fast', 2);
    slow = run(slow, 120000);
    for (let n = 0; n < 200 && !slow.done; n++) slow = run(answer(slow, true), 300);
    expect(playerPlace(slow)).toBe(2);
    expect(raceStars(slow)).toBe(1);
    expect(isMastered(slow)).toBe(false);
  });
  it('runs the shadow at the par time, or the best time once there is a faster one', () => {
    const par = createRace('normal', 5);
    expect(par.mode).toBe('shadow');
    expect(par.shadowMs).toBe(80000);
    const shadow = racer(run(par, 80000), 'shadow');
    expect(shadow.position).toBe(par.length);
    expect(shadow.finishedAt).toBe(80000);
    // The shadow ignores the pace setting and the rubber band: it is a recording.
    expect(racer(run(createRace('fast', 5), 40000), 'shadow').position).toBeCloseTo(
      par.length / 2,
      0,
    );
    const best = createRace('normal', 5, 60000);
    expect(best.shadowMs).toBe(60000);
    const slower = createRace('normal', 5, 120000);
    expect(slower.shadowMs).toBe(80000);
    let race = createRace('normal', 5, 60000);
    for (let n = 0; n < 200 && !race.done; n++) race = run(answer(race, true), 300);
    expect(playerPlace(race)).toBe(1);
    expect(raceStars(race)).toBe(3);
    const sprint = (bestMs: number) => {
      let state = createRace('normal', 5, bestMs);
      for (let n = 0; n < 200 && !state.done; n++) state = run(answer(state, true), 300);
      return state;
    };
    const time = sprint(60000).elapsedMs;
    const close = sprint(time * 0.9);
    expect(playerPlace(close)).toBe(2);
    expect(raceStars(close)).toBe(2);
    expect(isMastered(close)).toBe(false);
    const far = sprint(time * 0.5);
    expect(playerPlace(far)).toBe(2);
    expect(raceStars(far)).toBe(1);
  });
});
