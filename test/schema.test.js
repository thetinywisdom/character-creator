import { describe, expect, it } from 'vitest';
import { COMIC, PALETTE, COLORS } from '../src/palette.js';
import { defaults, normalize, randomize, migrate, SKINS } from '../src/index.js';

const v1 = {
  v: 1,
  id: 'abc',
  name: 'TEST PERSON NAME!!',
  gender: 'woman',
  body: 'fat',
  height: 9,
  skin: '#not-a-color',
  hair: 'not-a-style',
  hairColor: '#FF5491',
  hat: 'backcap',
  hatColor: '#203A57',
  top: 'stripetee',
  topColor: '#F0F2F4',
  innerColor: '#FF5491',
  bottom: 'shorts',
  bottomColor: '#203A57',
  shoes: 'barefoot',
  shoeColor: '#FFFFFF',
  acc: { glasses: true, sunglasses: true, moustache: true, beard: false, earrings: true, bag: true },
  accColor: '#FFCC3F',
  held: 'guitar',
  heldColor: '#ED8F02',
  lines: ['hello', 'there', 'friend', 'extra that is way too long '.repeat(5)],
  bubble: 'hi',
  home: 'fountain',
  dance: 'hula',
};

describe('normalize', () => {
  it('fills a man preset and clamps junk', () => {
    const d = normalize({
      name: 'x'.repeat(40),
      body: { height: -2, type: 'giant', shoulder: 4, belly: -3, hip: 0.25 },
      head: { hair: { style: 'mohawk-2000', color: '#nope' } },
      clothing: { top: { style: 'cape' } },
      hands: { left: { item: 'sword' } },
      animation: { dance: 'macarena' },
    });
    expect(d.v).toBe(2);
    expect(d.name).toHaveLength(18);
    expect(d.body.base).toBe('man');
    expect(d.body.type).toBe('average');
    expect(d.body.height).toBe(0.85);
    expect(d.body.shoulder).toBe(1);
    expect(d.body.belly).toBe(-1);
    expect(d.body.hip).toBe(0.25);
    expect(d.head.hair.style).toBe('curtains');
    expect(d.head.hair.color).toBe(PALETTE.black);
    expect(d.head.hair.highlight).toBe(PALETTE.npcLine);
    expect(d.clothing.top.style).toBe('tee');
    expect(d.hands.left.item).toBe('none');
    expect(d.hands.right.item).toBe('none');
    expect(d.animation.dance).toBe('disco');
    expect(d.animation.walkStyle).toBe('normal');
    expect(d.extra.lines).toEqual(['yo!', 'sup?', 'nice weather.']);
  });

  it('is idempotent and keeps a known woman preset', () => {
    const once = normalize(defaults('woman'));
    expect(once).toEqual(normalize(once));
    expect(once.body.base).toBe('woman');
    expect(once.body.height).toBe(0.96);
    expect(once.head.hair.style).toBe('longStraight');
    expect(once.head.ears.earrings).toBe(true);
    expect(once.clothing.top.style).toBe('blouse');
    expect(once.clothing.bottom.style).toBe('skirt');
    expect(once.clothing.shoes.style).toBe('flats');
  });

  it('accepts every skin and the 30 palette colours', () => {
    expect(COLORS).toHaveLength(30);
    expect(new Set(COLORS).size).toBe(30);
    for (const skin of SKINS) {
      expect(normalize({ body: { skin } }).body.skin).toBe(skin);
    }
    for (const color of COLORS) {
      expect(normalize({ clothing: { top: { color } } }).clothing.top.color).toBe(color);
    }
  });
});

describe('migrate', () => {
  it('converts an iso-city v1 def and parks game fields on extra', () => {
    const d = migrate(v1);
    expect(d.v).toBe(2);
    expect(d.name).toBe('TEST PERSON NAME!!'.slice(0, 18));
    expect(d.body).toMatchObject({ base: 'woman', type: 'fat', height: 1.15, shoulder: 0, belly: 0, hip: 0, torso: 'normal' });
    expect(d.body.skin).toBe(PALETTE.npcSkin);
    expect(d.head.hair.style).toBe('longStraight');
    expect(d.head.hair.color).toBe('#FF5491');
    expect(d.head.hair.highlight).toBe(PALETTE.npcLine);
    expect(d.head.headwear).toEqual({ style: 'backcap', color: '#203A57' });
    expect(d.head.eyewear).toBe('sunglasses');
    expect(d.head.facialHair).toBe('moustache');
    expect(d.head.ears).toEqual({ style: 'normal', earrings: true });
    expect(d.clothing.top).toEqual({ style: 'stripetee', color: '#F0F2F4', innerColor: '#FF5491' });
    expect(d.clothing.bottom).toEqual({ style: 'shorts', color: '#203A57' });
    expect(d.clothing.shoes.style).toBe('barefoot');
    expect(d.clothing.shoes.color).toBe(PALETTE.black);
    expect(d.back).toEqual({ style: 'bag', color: '#FFCC3F' });
    expect(d.hands.left).toEqual({ item: 'guitar', color: '#ED8F02' });
    expect(d.hands.right.item).toBe('none');
    expect(d.animation).toEqual({ dance: 'hula', walkStyle: 'normal' });
    expect(d.extra.id).toBe('abc');
    expect(d.extra.bubble).toBe('hi');
    expect(d.extra.home).toBe('fountain');
    expect(d.extra.lines[0]).toBe('hello');
    expect(d.extra.lines).toHaveLength(4);
    expect(d.extra.lines[3].length).toBeLessThanOrEqual(60);
    expect(d.arms.left.type).toBe('normal');
    expect(d.legs.right.type).toBe('normal');
  });

  it('round-trips the iso-city man and woman presets', () => {
    const man = {
      v: 1, name: 'NEW GUY', gender: 'man', body: 'average', height: 1, skin: PALETTE.npcSkin,
      hair: 'curtains', hairColor: PALETTE.black, hat: 'none', hatColor: COMIC.blues[1],
      top: 'tee', topColor: COMIC.blues[1], innerColor: PALETTE.white,
      bottom: 'pants', bottomColor: COMIC.blues[0], shoes: 'sneakers', shoeColor: PALETTE.white,
      acc: { glasses: false, sunglasses: false, moustache: false, beard: false, earrings: false, bag: false },
      accColor: COMIC.yellows[1], held: 'none', heldColor: COMIC.pinks[1],
      lines: ['yo!', 'sup?', 'nice weather.'], bubble: '', dance: 'disco', home: 'fountain',
    };
    const got = migrate(man);
    const want = defaults('man');
    expect(got.body).toEqual(want.body);
    expect(got.head).toEqual(want.head);
    expect(got.clothing).toEqual(want.clothing);
    expect(got.back).toEqual(want.back);
    expect(got.hands).toEqual(want.hands);
    expect(got.animation).toEqual(want.animation);
    expect(got.extra).toEqual(want.extra);
  });
});

describe('randomize', () => {
  it('is deterministic for a seed and varies across seeds', () => {
    expect(randomize(1)).toEqual(randomize(1));
    expect(randomize('kira')).toEqual(randomize('kira'));
    expect(randomize(1)).not.toEqual(randomize(2));
    const d = randomize(5);
    expect(d.v).toBe(2);
    expect(normalize(d)).toEqual(d);
    expect(d.extra.id).toBe('5');
  });
});
