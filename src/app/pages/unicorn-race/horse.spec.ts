import {
  cleanName,
  coatIds,
  hasHorn,
  hasWings,
  hornIds,
  horseKinds,
  LUMI,
  maneIds,
  markings,
  NAME_MAX,
  randomHorse,
  readHorse,
  sameHorse,
} from './horse';

describe('the horse a child races with', () => {
  it('starts as Lumi, the white unicorn with the rainbow mane', () => {
    expect(LUMI).toEqual({
      name: '',
      kind: 'unicorn',
      coat: 'snow',
      mane: 'rainbow',
      marking: 'none',
      horn: 'gold',
    });
    expect(hasHorn(LUMI.kind)).toBe(true);
    expect(hasWings(LUMI.kind)).toBe(false);
  });
  it('gives each kind its horn and wings', () => {
    expect(horseKinds.map((kind) => [hasHorn(kind), hasWings(kind)])).toEqual([
      [true, false],
      [false, true],
      [true, true],
      [false, false],
    ]);
  });
  it('tidies a typed name and keeps it short enough for the name tag', () => {
    expect(cleanName('  Star   Dust ')).toBe('Star Dust');
    expect(cleanName('Line\nbreak')).toBe('Line break');
    expect(cleanName('Supercalifragilistic')).toHaveLength(NAME_MAX);
    expect(cleanName('Ünïcörn Élodie')).toBe('Ünïcörn Élod');
    expect(cleanName('   ')).toBe('');
  });
  it('surprises with a random look but keeps the name', () => {
    const values = [0, 0.99, 0.5, 0.99, 0.3];
    let call = 0;
    const horse = randomHorse('Pip', () => values[call++ % values.length]);
    expect(horse).toEqual({
      name: 'Pip',
      kind: horseKinds[0],
      coat: coatIds[coatIds.length - 1],
      mane: maneIds[Math.floor(0.5 * maneIds.length)],
      marking: markings[markings.length - 1],
      horn: hornIds[1],
    });
    for (let n = 0; n < 50; n++) {
      const random = randomHorse('Pip');
      expect(readHorse(random)).toEqual(random);
    }
  });
  it('reads a stored horse and replaces only the parts that are not valid', () => {
    expect(readHorse(null)).toEqual(LUMI);
    expect(readHorse('Lumi')).toEqual(LUMI);
    expect(
      readHorse({
        name: 'Mo',
        kind: 'pegasus',
        coat: 'sky',
        mane: 'berry',
        marking: 'blaze',
        horn: 'crystal',
      }),
    ).toEqual({
      name: 'Mo',
      kind: 'pegasus',
      coat: 'sky',
      mane: 'berry',
      marking: 'blaze',
      horn: 'crystal',
    });
    // A horse saved before markings and horn colours keeps its look and gets Lumi's for those.
    expect(readHorse({ name: 'Mo', kind: 'pony', coat: 'sky', mane: 'berry' })).toEqual({
      name: 'Mo',
      kind: 'pony',
      coat: 'sky',
      mane: 'berry',
      marking: 'none',
      horn: 'gold',
    });
    expect(readHorse({ kind: 'griffin', coat: 'sky' })).toEqual({ ...LUMI, coat: 'sky' });
  });
  it('tells two horses apart by any part', () => {
    expect(sameHorse(LUMI, { ...LUMI })).toBe(true);
    expect(sameHorse(LUMI, { ...LUMI, name: 'Lu' })).toBe(false);
    expect(sameHorse(LUMI, { ...LUMI, mane: 'night' })).toBe(false);
    expect(sameHorse(LUMI, { ...LUMI, marking: 'star' })).toBe(false);
    expect(sameHorse(LUMI, { ...LUMI, horn: 'rose' })).toBe(false);
  });
});
