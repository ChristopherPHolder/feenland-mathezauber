import { describe, expect, it } from 'vitest';
import { coinsAt, KEY_START, KEY_STEP } from './lock-reward';
import { rewardNotes } from './lock-sounds';

describe('the chest-opening sound', () => {
  it('rings one rising bell per golden key, in time with the keys popping in', () => {
    const bells = (keys: number) =>
      rewardNotes('open', keys).filter((note) => note.at >= KEY_START && note.length > 0.5);
    expect(bells(1).map((note) => note.at)).toEqual([KEY_START]);
    const three = bells(3);
    expect(three.map((note) => note.at)).toEqual([
      KEY_START,
      KEY_START + KEY_STEP,
      KEY_START + 2 * KEY_STEP,
    ]);
    expect(three[1].frequency).toBeGreaterThan(three[0].frequency);
    expect(three[2].frequency).toBeGreaterThan(three[1].frequency);
  });

  it('starts with the lock clunk and ends with the coins jingling after the last key', () => {
    const notes = rewardNotes('perfect', 2);
    expect(notes[0]).toMatchObject({ at: 0, wave: 'triangle' });
    const last = Math.max(...notes.map((note) => note.at));
    expect(last).toBeGreaterThan(coinsAt(2));
    expect(coinsAt(2)).toBeGreaterThan(KEY_START + KEY_STEP);
  });
});
