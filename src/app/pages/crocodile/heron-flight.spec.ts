import { type FlightLayout, heronLapSeconds, heronLoop } from './heron-flight';

// Pond layouts measured in the browser: the pond's size, Kiki and the pads, and the instruction.
const phone: FlightLayout = {
  width: 366,
  height: 423,
  padsTop: 124,
  padsBottom: 243,
  floor: 363,
  reach: 52,
};
const tabletPortrait: FlightLayout = {
  width: 788,
  height: 720,
  padsTop: 215,
  padsBottom: 414,
  floor: 638,
  reach: 113,
};
const tabletLandscape: FlightLayout = {
  width: 920,
  height: 354,
  padsTop: 45,
  padsBottom: 231,
  floor: 272,
  reach: 71,
};

const angles = Array.from({ length: 360 }, (_, step) => (step / 360) * Math.PI * 2);

function inView(layout: FlightLayout, point: { x: number; y: number }) {
  const margin = layout.reach / 2;
  return (
    point.x > -margin &&
    point.x < layout.width + margin &&
    point.y > -margin &&
    point.y < layout.height + margin
  );
}

function shareInView(layout: FlightLayout, progress: number) {
  return angles.filter((angle) => inView(layout, heronLoop(progress, angle, layout))).length / 360;
}

describe('the heron flight loop', () => {
  for (const [name, layout] of [
    ['phone', phone],
    ['tablet portrait', tabletPortrait],
  ] as const) {
    it(`never flies over Kiki or the pads on a ${name}`, () => {
      for (const progress of [0, 0.25, 0.5, 0.75, 1])
        for (const angle of angles) {
          const point = heronLoop(progress, angle, layout);
          if (!inView(layout, point)) continue;
          const clearance = Math.max(layout.padsTop - point.y, point.y - layout.padsBottom);
          expect(clearance).toBeGreaterThan(layout.reach * 0.7);
        }
    });

    it(`crosses above and below the pads on a ${name}`, () => {
      const seen = angles
        .map((angle) => heronLoop(0.5, angle, layout))
        .filter((point) => point.x > 0 && point.x < layout.width);
      expect(seen.some((point) => point.y < layout.padsTop)).toBe(true);
      expect(seen.some((point) => point.y > layout.padsBottom && point.y < layout.floor)).toBe(
        true,
      );
    });
  }

  it('leaves the view and comes back, showing up more as time runs out', () => {
    for (const layout of [phone, tabletPortrait, tabletLandscape]) {
      const early = shareInView(layout, 0);
      const late = shareInView(layout, 1);
      expect(early).toBeGreaterThan(0);
      expect(early).toBeLessThan(0.5);
      expect(late).toBeGreaterThan(early);
      expect(late).toBeLessThan(1);
    }
  });

  it('skims the top edge and passes out of sight below when a landscape pond has no room', () => {
    const ys = angles.map((angle) => heronLoop(0.5, angle, tabletLandscape).y);
    expect(Math.min(...ys)).toBeLessThanOrEqual(
      tabletLandscape.padsTop - tabletLandscape.reach / 2,
    );
    expect(Math.max(...ys)).toBeGreaterThan(tabletLandscape.height);
  });

  it('starts off the right edge of the pond', () => {
    for (const layout of [phone, tabletPortrait, tabletLandscape])
      expect(heronLoop(0, 0, layout).x).toBeGreaterThan(layout.width + layout.reach);
  });

  it('laps faster as the snack is nearly gone', () => {
    expect(heronLapSeconds(1)).toBeLessThan(heronLapSeconds(0));
  });
});
