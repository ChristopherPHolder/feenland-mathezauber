import { advance, cast, freshBattle, resolveSpell } from './battle';
import { castleFrame, streakOf } from './castle-frame';

const options = { started: true, paused: false, badge: '9' };

describe('castle frame for the 3D battlefield', () => {
  it('counts first-try answers back from the latest one', () => {
    expect(streakOf([])).toBe(0);
    expect(streakOf([true, true])).toBe(2);
    expect(streakOf([true, false, true])).toBe(1);
    expect(streakOf([true, true, false])).toBe(0);
  });

  it('starts a wave with the creature far down the path and the next one waiting', () => {
    const frame = castleFrame(freshBattle(), options);
    expect(frame.approach).toBe(0);
    expect(frame.hearts).toBe(3);
    expect(frame.spell).toBeNull();
    expect(frame.waiting).not.toBeNull();
    expect(frame.pressure).toBe(0);
  });

  it('gives every cast a new turn and steps the creature closer after a mistake', () => {
    const start = freshBattle();
    const casting = cast(start, 5);
    const before = castleFrame(start, options);
    const during = castleFrame(casting, options);
    expect(during.turn).not.toBe(before.turn);
    expect(during.spell).toBe(5);
    const wrong = castleFrame(resolveSpell(casting), options);
    expect(wrong.phase).toBe('wrong');
    expect(wrong.approach).toBe(1);
  });

  it('marks the mistake that reaches the gate as damage', () => {
    let state = freshBattle();
    for (let index = 0; index < 3; index++) state = advance(resolveSpell(cast(state, 5)));
    const frame = castleFrame(state, options);
    expect(frame.damaged).toBe(true);
    expect(frame.hearts).toBe(2);
    expect(frame.approach).toBe(0);
  });
});
