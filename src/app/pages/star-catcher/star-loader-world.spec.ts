import { describe, expect, it } from 'vitest';
import { CATCH_SECONDS, catchPhase } from './star-loader-world';

describe('star loader motion', () => {
  it('drops a star into the net, flashes, then lets it float away', () => {
    expect(catchPhase(0)).toEqual({ catch: 0, fall: 0, flash: null, rise: null });
    expect(catchPhase(CATCH_SECONDS * 0.25).fall).toBeCloseTo(0.5);
    expect(catchPhase(CATCH_SECONDS * 0.55)).toMatchObject({ fall: null, rise: null });
    expect(catchPhase(CATCH_SECONDS * 0.65).flash).toBeCloseTo(0.5);
    expect(catchPhase(CATCH_SECONDS * 0.785).rise).toBeCloseTo(0.5);
    expect(catchPhase(CATCH_SECONDS * 0.97)).toMatchObject({ fall: null, flash: null, rise: null });
  });

  it('loops on the same beat, counting each catch', () => {
    const later = catchPhase(CATCH_SECONDS * 3.25);
    expect(later.catch).toBe(3);
    expect(later.fall).toBeCloseTo(catchPhase(CATCH_SECONDS * 0.25).fall!);
  });
});
