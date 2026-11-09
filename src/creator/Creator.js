import { CLOTH_COLORS, HAIR_COLORS, SKIN_TONES, skinTone, snapColor } from '../styles/palette.js';

// Character creator panel (Characters mode): every setting of the character
// as tappable chips, colour swatches and big sliders, in four tabs. It is
// built from the subject's own schema, so new settings show up by themselves,
// and it asks the subject's rules which options are allowed (no beards on
// women, no skirts on men, ...). The 3D preview is drawn by the app next to
// (desktop) or above (phone) this panel.

const TABS = [
  ['body', 'Body'],
  ['hair', 'Hair & face'],
  ['clothes', 'Clothes'],
  ['extras', 'Accessories'],
];
// which tab each setting lives on (unlisted settings go by their schema group)
const TAB_OF = {
  hair: 'hair', hairColor: 'hair', beard: 'hair', moustache: 'hair',
  faceAccessory: 'hair', accessoryColor: 'hair', mask: 'hair', maskColor: 'hair',
  headwear: 'extras', headwearColor: 'extras',
  backAccessory: 'extras', backColor: 'extras', bodyAccessory: 'extras', bodyAccessoryColor: 'extras',
};
const GROUP_TAB = { Body: 'body', 'Body shape (woman)': 'body', Hair: 'hair', Head: 'hair', Accessories: 'extras', Clothes: 'clothes' };
const SWATCHES = { skin: SKIN_TONES, hairColor: HAIR_COLORS };
const hex = (n) => `#${(n ?? 0x888888).toString(16).padStart(6, '0')}`;
// "long · twin tails" -> "Twin tails"; "short" -> "Short"
const nice = (v) => {
  const s = String(v).includes(' · ') ? String(v).split(' · ')[1] : String(v);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export class Creator {
  /**
   * subject: the human subject (schema, presets, rules); params: its live
   * values; onChange(key): called after a value changes (the app applies
   * the rules and rebuilds); actions: { randomize(), reset(), preset(name),
   * anim(name) } and getAnim() -> 'Still' | 'Walk' | 'Run'.
   */
  constructor({ subject, params, onChange, actions }) {
    this.subject = subject;
    this.params = params;
    this.onChange = onChange;
    this.actions = actions;
    this.tab = 'body';
    const el = document.createElement('aside');
    el.id = 'creator';
    el.hidden = true;
    el.innerHTML = `
      <div class="cr-top">
        <div class="cr-tabs">${TABS.map(([k, l]) => `<button data-tab="${k}">${l}</button>`).join('')}</div>
        <div class="cr-actions">
          <button data-act="random" title="A random character">🎲 Random</button>
          <button data-act="reset" title="Back to the default character">↺</button>
          <button data-act="export" title="Save this character as a JSON file">⬇ JSON</button>
          <button data-act="import" title="Open a character JSON file">⬆</button>
        </div>
      </div>
      <div class="cr-body"></div>`;
    document.body.appendChild(el);
    this.el = el;
    // play controls float over the preview
    const play = document.createElement('div');
    play.id = 'creator-play';
    play.hidden = true;
    play.innerHTML = ['Still', 'Walk', 'Run'].map((a) => `<button data-anim="${a}">${{ Still: '■ Still', Walk: '🚶 Walk', Run: '🏃 Run' }[a]}</button>`).join('');
    document.body.appendChild(play);
    this.play = play;
    play.addEventListener('click', (e) => {
      const a = e.target.closest('[data-anim]')?.dataset.anim;
      if (a) { this.actions.anim(a); this.updatePlay(); }
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.tab) { this.tab = b.dataset.tab; this.render(); }
      if (b.dataset.act === 'random') { this.actions.randomize(); this.render(); }
      if (b.dataset.act === 'reset') { this.actions.reset(); this.render(); }
      if (b.dataset.act === 'export') this.actions.exportJson();
      if (b.dataset.act === 'import') this.actions.importJson().then(() => this.render());
      if (b.dataset.preset) { this.actions.preset(b.dataset.preset); this.render(); }
      if (b.dataset.outfit) { Object.assign(this.params, this.subject.outfits[b.dataset.outfit]); this.onChange('outfit'); this.render(); }
      if (b.dataset.key) this.set(b.dataset.key, b.dataset.val);
    });
    el.addEventListener('input', (e) => {
      const r = e.target.closest('input[type=range]');
      if (!r) return;
      this.params[r.dataset.key] = Number(r.value);
      r.parentElement.querySelector('output').textContent = this.format(r.dataset.key, Number(r.value));
      this.onChange(r.dataset.key);
    });
    el.addEventListener('change', (e) => { if (e.target.matches('input[type=range]')) this.render(); });
  }

  set(key, val) {
    this.params[key] = val;
    this.onChange(key);
    this.render();
  }

  format(key, v) {
    const def = this.subject.schema[key];
    if (key === 'height') return `${v.toFixed(2)} m`;
    if (key === 'headsTall') return `${v.toFixed(1)} heads`;
    return def.step >= 0.05 ? v.toFixed(2) : v.toFixed(3);
  }

  /** Redraw the active tab (values, allowed options, hidden controls). */
  render() {
    const { schema } = this.subject;
    const p = this.params;
    this.el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    const hidden = this.subject.hiddenControls?.(p) ?? { keys: new Set(), groups: new Set() };
    const body = this.el.querySelector('.cr-body');
    body.replaceChildren();
    const section = (title) => {
      const s = document.createElement('section');
      if (title) s.appendChild(Object.assign(document.createElement('h3'), { textContent: title }));
      body.appendChild(s);
      return s;
    };
    // ready-made looks (clothes only) at the top of the Clothes tab
    if (this.tab === 'clothes' && this.subject.outfits) {
      const row = section('Looks').appendChild(Object.assign(document.createElement('div'), { className: 'cr-chips' }));
      for (const name of Object.keys(this.subject.outfits)) {
        row.appendChild(Object.assign(document.createElement('button'), { textContent: name })).dataset.outfit = name;
      }
    }
    for (const [key, def] of Object.entries(schema)) {
      const tab = TAB_OF[key] ?? GROUP_TAB[def.group] ?? 'body';
      if (tab !== this.tab || hidden.keys.has(key) || hidden.groups.has(def.group)) continue;
      const s = section(this.subject.labelFor?.(key, p) ?? def.label ?? key);
      if (def.options) {
        const allowed = this.subject.allowedOptions?.(key, p) ?? def.options;
        const row = s.appendChild(Object.assign(document.createElement('div'), { className: 'cr-chips' }));
        const colours = SWATCHES[key] ?? (/Color$/.test(key) ? CLOTH_COLORS : null);
        for (const v of allowed) {
          const b = document.createElement('button');
          b.dataset.key = key;
          b.dataset.val = v;
          b.classList.toggle('on', p[key] === v);
          if (colours) {
            b.className += ' cr-swatch';
            b.title = v;
            b.style.background = hex(key === 'skin' ? skinTone(colours[v]) : snapColor(colours[v])); // as the active palette shows it
          } else b.textContent = nice(v);
          row.appendChild(b);
        }
        if (colours) s.querySelector('h3').textContent += ` · ${p[key]}`;
      } else {
        const wrap = s.appendChild(Object.assign(document.createElement('div'), { className: 'cr-slider' }));
        const r = Object.assign(document.createElement('input'), { type: 'range', min: def.min, max: def.max, step: def.step, value: p[key] });
        r.dataset.key = key;
        wrap.append(r, Object.assign(document.createElement('output'), { textContent: this.format(key, p[key]) }));
      }
    }
    this.updatePlay();
  }

  updatePlay() {
    const a = this.actions.getAnim();
    this.play.querySelectorAll('[data-anim]').forEach((b) => b.classList.toggle('on', b.dataset.anim === a));
  }

  show(on) {
    this.el.hidden = !on;
    this.play.hidden = !on;
    if (on) this.render();
  }

  /** The part of the screen left for the 3D preview: { x, y, w, h } in CSS px (y from the top). */
  previewRect(W, H) {
    if (this.el.hidden) return { x: 0, y: 0, w: W, h: H };
    const r = this.el.getBoundingClientRect();
    if (r.left > W * 0.3) return { x: 0, y: 0, w: r.left, h: H };       // panel on the right
    return { x: 0, y: 0, w: W, h: Math.max(80, r.top) };                 // panel at the bottom
  }
}
