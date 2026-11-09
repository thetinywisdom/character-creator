import { ComedyStage, COMEDY } from './city/comedy.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { subjects } from './subjects/index.js';
import { lightingPresets, style } from './styles/index.js';
import { Cell } from './viewer/Cell.js';
import { defaultsFor, loadParams, saveParams } from './viewer/params.js';
import { createPs1Renderer } from './render/ps1.js';
import { ASSETS, CATALOG, createAsset } from './catalog/index.js';
import { thumbInto } from './catalog/thumbs.js';
import { City } from './city/City.js';
import { CHARGE } from './city/interact.js';
import { CityInput } from './city/input.js';
import { generateCityData } from './city/layout.js';
import { setNightGlow, setSnowCover } from './city/atmosphere.js';
import { SHOP_TYPES } from './city/buildings.js';
import { Creator } from './creator/Creator.js';
import { RUN_SPEED, WALK_SPEED, createGait, poseGait, stepGait } from './anim/gait.js';
import { CAT_RUN_SPEED, CAT_WALK_SPEED, createCatGait, poseCat, stepCatGait } from './anim/catGait.js';
import { saveFile, openTextFile } from './lib/saveFile.js';
import { CLOTH_COLORS, PALETTE } from './styles/palette.js';
import './style.css';

// Tiny City Builder: a viewer for the foundation that games are built on.
//   📦 Catalogue   every placeable item, with its id and settings
//   👤 Characters  design a character and export / import it as JSON
//   🏙 City        walk a generated sample town (third person or isometric)
// Everything shown here is plain modules under src/ that games reuse (see SKILLS.md).

const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const ps1 = createPs1Renderer(renderer);
const PAGE_BG = new THREE.Color('#1d1f23');

const params = loadParams(subjects);
const human = subjects.find((s) => s.id === 'human');
const state = { view: 'catalog', anim: 'Still', itemAnim: 'Walk', lighting: 'Day', weather: 'Clear', citySeed: 3, cityView: 'third' };

const hint = document.querySelector('#hint');
const toastEl = document.querySelector('#toast');
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
}

// A preview stage + orbit camera, shared by the catalogue and the character creator.
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 500);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
let reframe = true;

// ---------------------------------------------------------------------------
// 📦 Catalogue
// ---------------------------------------------------------------------------
const TABS = [['palette', '🎨 Palette'], ['all', 'All'], ['buildings', 'Buildings'], ['street', 'Street'], ['traffic', 'Traffic'], ['extras', 'Extras'], ['nature', 'Nature'], ['animals', 'Animals'], ['vehicles', 'Vehicles'], ['areas', 'Areas']];
const catalogEl = document.querySelector('#catalog');
const itemEl = document.querySelector('#item');
const items = ASSETS.filter((a) => a.group);
let catTab = 'all';
let selected = null; // { id, params }
let itemCell = null;

function renderCatalog() {
  const tabs = catalogEl.querySelector('.cat-tabs');
  tabs.replaceChildren(...TABS.map(([k, l]) => {
    const b = Object.assign(document.createElement('button'), { textContent: k === 'palette' ? l : `${l} ${k === 'all' ? items.length : items.filter((a) => a.group === k).length}` });
    b.classList.toggle('on', k === catTab);
    b.onclick = () => { catTab = k; renderCatalog(); };
    return b;
  }));
  const grid = catalogEl.querySelector('.cat-grid');
  if (catTab === 'palette') {
    // the colour palette everything snaps to (styles/palette.js)
    grid.replaceChildren(...Object.entries(PALETTE).map(([name, hex]) => {
      const card = document.createElement('div');
      card.className = 'cat-card pal-card';
      const h = `#${hex.toString(16).padStart(6, '0')}`;
      card.append(Object.assign(document.createElement('i'), { style: `background:${h}` }), Object.assign(document.createElement('b'), { textContent: name }), Object.assign(document.createElement('code'), { textContent: h }));
      return card;
    }));
    return;
  }
  grid.replaceChildren(...items.filter((a) => catTab === 'all' || a.group === catTab).map((a) => {
    const card = document.createElement('button');
    card.className = 'cat-card';
    const img = document.createElement('img');
    img.alt = '';
    card.append(img, Object.assign(document.createElement('b'), { textContent: a.label }), Object.assign(document.createElement('code'), { textContent: a.id }));
    card.onclick = () => openItem(a.id);
    thumbInto(img, renderer, style, a.id, {});
    return card;
  }));
}

function openItem(id, p) {
  const a = CATALOG[id];
  selected = { id, params: { ...a.params, ...p } };
  const subject = { id: 'item', label: a.label, schema: {}, isProp: true, build: (_q, st) => createAsset(id, selected.params, st) };
  itemCell = new Cell({ entries: [{ subject }], style, renderer });
  itemCell.rebuild({});
  itemCell.applyLighting(lightingPresets[state.lighting]);
  setNightGlow(itemCell.scene, !!lightingPresets[state.lighting].night);
  reframe = true;
  renderItemPanel();
  setView('item');
}

const OPTION_LABELS = { pattern: 'Pattern', tailType: 'Tail', earType: 'Ears', coat: 'Coat' };
function renderItemPanel() {
  const a = CATALOG[selected.id];
  const p = selected.params;
  const chips = (label, key, values, swatch = false) => {
    if (!values || values.length < 2) return '';
    return `<h3>${label}</h3><div class="chips">${values.map((v) => `<button data-k="${key}" data-v="${v ?? ''}" class="${(p[key] ?? '') === (v ?? '') ? 'on' : ''}${swatch ? ' sw' : ''}" ${swatch ? `title="${v}" style="background:#${(a.swatches?.[v] ?? CLOTH_COLORS[v] ?? 0x888888).toString(16).padStart(6, '0')}"` : ''}>${swatch ? '' : v ?? 'Any'}</button>`).join('')}</div>`;
  };
  const shopTypes = 'shopType' in a.params ? [null, ...SHOP_TYPES] : null;
  const code = `createAsset('${a.id}', ${JSON.stringify(p)}, style)`;
  itemEl.innerHTML = `
    <div class="it-head"><button data-act="back">← Catalogue</button><b>${a.label}</b></div>
    <div class="it-body">
      <p class="it-id"><code>${a.id}</code> · ${a.category} · about ${a.size[0]} × ${a.size[1]} m</p>
      ${chips('Type', 'variant', a.variants)}
      ${chips('Colour', 'color', a.colors, true)}
      ${chips('Shop', 'shopType', shopTypes)}
      ${Object.entries(a.options ?? {}).map(([k, vals]) => chips(OPTION_LABELS[k] ?? k, k, vals)).join('')}
      ${a.animated ? `<h3>Animation</h3><div class="chips">${['Still', 'Walk', 'Run', 'Sit', 'Loaf', 'Sleep'].map((m) => `<button data-anim="${m}" class="${state.itemAnim === m ? 'on' : ''}">${m}</button>`).join('')}</div>` : ''}
      ${'seed' in a.params ? '<h3>Look</h3><div class="chips"><button data-act="seed">🎲 New look</button></div>' : ''}
      <h3>Use it in a game</h3>
      <pre>${code}</pre>
      <button data-act="copy">Copy</button>
    </div>`;
  itemEl.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'back') return setView('catalog');
    if (b.dataset.anim) { state.itemAnim = b.dataset.anim; return renderItemPanel(); }
    if (b.dataset.act === 'copy') return navigator.clipboard?.writeText(code).then(() => toast('Copied'), () => toast(code));
    if (b.dataset.act === 'seed') selected.params.seed = Math.floor(Math.random() * 1e9);
    if (b.dataset.k) selected.params[b.dataset.k] = b.dataset.v === '' ? null : b.dataset.v;
    openItem(selected.id, selected.params);
  };
}

// ---------------------------------------------------------------------------
// 👤 Characters
// ---------------------------------------------------------------------------
const humanCell = new Cell({ entries: [{ subject: human }], style, renderer });
humanCell.rebuild(params);
humanCell.applyLighting(lightingPresets[state.lighting]);
let lastHuman = { ...params.human };
/** After any change: apply the character rules, rebuild the preview, remember the settings. */
function humanChanged(key) {
  if (key) human.adjust?.(params.human, key, lastHuman[key]);
  human.applyRules?.(params.human);
  lastHuman = { ...params.human };
  humanCell.rebuild(params);
  saveParams(params);
  city = null; // the city's player is this character
}
const CHARACTER_FORMAT = 'tiny-character';
const creator = new Creator({
  subject: human,
  params: params.human,
  onChange: (key) => { humanChanged(key); if (['bodyType', 'height', 'headsTall', 'legLength', 'build'].includes(key)) reframe = true; },
  actions: {
    randomize: () => { Object.assign(params.human, human.randomize()); humanChanged(); reframe = true; },
    reset: () => { Object.assign(params.human, defaultsFor(human), human.presets[params.human.bodyType]); humanChanged(); reframe = true; },
    preset: (name) => { Object.assign(params.human, human.presets[name]); humanChanged(); reframe = true; },
    anim: (a) => { state.anim = a; },
    getAnim: () => state.anim,
    // export / import the character as JSON (format: SKILLS.md, "Character JSON")
    exportJson: async () => {
      const json = JSON.stringify({ format: CHARACTER_FORMAT, version: 1, params: params.human }, null, 1);
      const ok = await saveFile(`character-${params.human.bodyType.toLowerCase()}.json`, json);
      if (!ok) { navigator.clipboard?.writeText(json); toast('Copied the JSON instead'); }
    },
    importJson: async () => {
      const text = await openTextFile('.json,application/json');
      if (text == null) return;
      try {
        const d = JSON.parse(text);
        const p = d.format === CHARACTER_FORMAT ? d.params : d; // a bare settings object works too
        Object.assign(params.human, defaultsFor(human), p);
        humanChanged(); reframe = true;
        toast('Character loaded');
      } catch { toast('That file is not a character JSON'); }
    },
  },
});

// ---------------------------------------------------------------------------
// 🏙 City
// ---------------------------------------------------------------------------
const joystick = document.querySelector('#joystick');
const cityInput = new CityInput(canvas, joystick);
let city = null;
function ensureCity() {
  if (!city) {
    city = new City({ style, renderer, human, cat: subjects.find((s) => s.id === 'cat'), params, data: generateCityData(state.citySeed) });
    city.applyLighting(lightingPresets[state.lighting]);
    if (state.weather !== 'Clear') city.setWeather(state.weather);
    if (state.cityView === 'iso') city.setViewMode('iso');
  }
  return city;
}
const viewBtn = document.querySelector('#viewBtn');
function updateCityBar() {
  const iso = city?.viewMode === 'iso';
  viewBtn.innerHTML = iso ? '🎥<span> 3rd person</span>' : '🎥<span> Iso view</span>';
  document.querySelector('#lightBtn').innerHTML = `${{ Day: '☀', Sunset: '🌇', Night: '🌙' }[state.lighting]}<span> ${state.lighting}</span>`;
  document.querySelector('#weatherBtn').innerHTML = `${{ Clear: '🌤', Rain: '🌧', Snow: '❄' }[state.weather]}<span> ${state.weather}</span>`;
  hint.textContent = iso
    ? 'WASD / arrows · Shift run · drag to turn · scroll or pinch to zoom · < > rotate · V third person · E interact / ride · click: menu · hold: slap · double: push · right: talk · B banana'
    : 'WASD / arrows · Shift run · drag to look · E interact / ride · Space jump · click: menu · hold: slap · double: push · right: talk · B banana · V iso';
}
viewBtn.onclick = () => { state.cityView = ensureCity().setViewMode(); updateCityBar(); };
document.querySelector('#newTownBtn').onclick = () => { state.citySeed = Math.floor(Math.random() * 1000); city = null; ensureCity(); toast(`Town #${state.citySeed}`); };
document.querySelector('#lightBtn').onclick = () => {
  const names = Object.keys(lightingPresets);
  state.lighting = names[(names.indexOf(state.lighting) + 1) % names.length];
  for (const c of [city, humanCell, itemCell]) c?.applyLighting(lightingPresets[state.lighting]);
  if (itemCell) setNightGlow(itemCell.scene, !!lightingPresets[state.lighting].night);
  updateCityBar();
};
document.querySelector('#weatherBtn').onclick = () => {
  const all = ['Clear', 'Rain', 'Snow'];
  state.weather = ensureCity().setWeather(all[(all.indexOf(state.weather) + 1) % all.length]);
  updateCityBar();
};
window.addEventListener('keydown', (e) => {
  if (state.view !== 'city' || !city) return;
  if (e.code === 'KeyV') { state.cityView = city.setViewMode(); updateCityBar(); }
  // < and > turn the iso view (E is the action key)
  if (city.viewMode === 'iso' && e.code === 'Comma') city.rotateIso(-1);
  if (city.viewMode === 'iso' && e.code === 'Period') city.rotateIso(1);
});

// ---------------------------------------------------------------------------
// Views and the app bar
// ---------------------------------------------------------------------------
const MODE = { catalog: 'catalog', item: 'catalog', creator: 'characters', city: 'city' };
function setView(view) {
  state.view = view;
  const mode = MODE[view];
  document.querySelectorAll('#modes [data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  catalogEl.hidden = view !== 'catalog';
  itemEl.hidden = view !== 'item';
  creator.show(view === 'creator');
  document.querySelectorAll('.city-only').forEach((b) => { b.hidden = view !== 'city'; });
  cityInput.active = view === 'city';
  joystick.hidden = !(view === 'city' && (matchMedia('(pointer: coarse)').matches || window.innerWidth < 900));
  overlay.hidden = view !== 'city';
  document.querySelector('#cityActions').hidden = view !== 'city';
  controls.enabled = view === 'item' || view === 'creator';
  if (view === 'catalog') { hint.textContent = 'Tap an item to turn it around and see its settings'; renderCatalog(); }
  if (view === 'item' || view === 'creator') { hint.textContent = 'Drag to turn · scroll or pinch to zoom'; reframe = true; }
  if (view === 'city') { ensureCity(); updateCityBar(); }
  // snow lies on shared materials: show it only in the city
  if (city) setSnowCover(city.scene, view === 'city' && state.weather === 'Snow');
}
document.querySelector('#modes').onclick = (e) => {
  const m = e.target.closest('[data-mode]')?.dataset.mode;
  if (m) setView({ catalog: 'catalog', characters: 'creator', city: 'city' }[m]);
};
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.view === 'item') setView('catalog'); });

// ---------------------------------------------------------------------------
// City overlay: chat bubbles, comic bursts and the pie menu (interact.js),
// drawn as page elements so the text stays sharp over the low-res picture
// ---------------------------------------------------------------------------
const overlay = document.querySelector('#overlay');
const pie = document.querySelector('#pie');
const chargeEl = Object.assign(document.createElement('div'), { id: 'charge', hidden: true });
overlay.appendChild(chargeEl);
const bubbleEls = new Map();
pie.addEventListener('click', (e) => {
  const b = e.target.closest('[data-n]');
  if (b) cityInput.events.push({ type: 'choose', n: Number(b.dataset.n) });
});
document.querySelector('#actBtn').onclick = () => cityInput.events.push({ type: 'primary' });
document.querySelector('#fartBtn').onclick = () => cityInput.events.push({ type: 'fart' });
document.querySelector('#bananaBtn').onclick = () => cityInput.events.push({ type: 'banana' });
document.querySelector('#jumpBtn').onclick = () => cityInput.events.push({ type: 'jump' });
function screenOf(v, camera, W, H) {
  const s = v.clone().project(camera);
  return { x: (s.x + 1) / 2 * W, y: (1 - s.y) / 2 * H, ok: s.z < 1 && Math.abs(s.x) < 1.3 && Math.abs(s.y) < 1.3 };
}
/**
 * Speech bubbles never cover each other: the oldest keeps its place over its
 * speaker, each newer one that would overlap is lifted above, and its tail
 * stretches down to its speaker (--lift), so in a crowd everyone is heard at once.
 * The pie menu, when open, counts as already taken.
 */
function stackBubbles(list, pie) {
  const placed = [];
  if (pie?.ok) placed.push({ x0: pie.x - 115, x1: pie.x + 115, y0: pie.y - 120, y1: pie.y + 6 });
  list.sort((a, b) => a.b.id - b.b.id);
  for (const { b, el, s } of list) {
    const w = el.offsetWidth, h = el.offsetHeight;
    const fx = b.side === 'left' ? 0.88 : b.side === 'right' ? 0.12 : 0.5;
    const x0 = s.x - w * fx - 4, x1 = x0 + w + 8;
    let y1 = s.y + 4, lift = 0;
    for (let guard = 0; guard < 12; guard++) {
      const hit = placed.find((r) => r.x0 < x1 && r.x1 > x0 && r.y0 < y1 && r.y1 > y1 - h - 8);
      if (!hit) break;
      y1 = hit.y0 - 2;
      lift = s.y + 4 - y1;
    }
    placed.push({ x0, x1, y0: y1 - h - 8, y1 });
    // ease towards the new height so bubbles slide rather than jump
    const cur = Number(el.dataset.lift ?? 0), next = cur + (lift - cur) * 0.35;
    el.dataset.lift = String(next);
    el.style.marginTop = `${-next}px`;
    el.style.setProperty('--lift', `${next}px`);
    el.classList.toggle('lifted', next > 6);
  }
}

function drawOverlay(c, W, H) {
  const ix = c.ix, cam = c.activeCamera;
  const live = new Set();
  const talk = []; // speech bubbles on screen, stacked after this loop
  for (const b of ix.bubbles) {
    if (b.age < 0) continue;
    live.add(b.id);
    let el = bubbleEls.get(b.id);
    if (!el) {
      el = document.createElement('div');
      if (b.kind === 'burst') {
        // two spiky stars (outer and inner) behind outlined pixel text
        el.className = 'burst';
        el.style.setProperty('--tilt', `${(Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 8)}deg`);
        el.innerHTML = `<i class="b-out"></i><i class="b-in"></i><b>${b.text}</b>`;
      } else if (b.kind === 'confused') {
        el.className = 'qbox';
        el.textContent = '?';
      } else {
        el.className = `bubble ${b.kind}${b.side ? ` ${b.side}` : ''}`;
        el.innerHTML = `${b.name ? `<small>${b.name}</small>` : ''}<span></span>`;
        el.querySelector('span').textContent = b.text;
      }
      overlay.appendChild(el);
      bubbleEls.set(b.id, el);
    }
    const s = screenOf(b.anchor(), cam, W, H);
    el.style.display = s.ok ? '' : 'none';
    el.style.left = `${s.x}px`;
    el.style.top = `${s.y}px`;
    if (b.kind === 'talk') el.style.opacity = String(Math.min(1, (b.life - b.age) / 0.4));
    if (s.ok && (b.kind === 'talk' || b.kind === 'shout')) talk.push({ b, el, s });
  }
  stackBubbles(talk, ix.menu ? screenOf(ix.headOf(ix.menu.npc)(), cam, W, H) : null);
  for (const [id, el] of bubbleEls) if (!live.has(id)) { el.remove(); bubbleEls.delete(id); }
  // the pie menu pops out of the person you chose
  pie.hidden = !ix.menu;
  if (ix.menu) {
    const s = screenOf(ix.headOf(ix.menu.npc)(), cam, W, H);
    pie.style.left = `${s.x}px`;
    pie.style.top = `${s.y}px`;
  }
  document.querySelector('#actBtn').textContent = c.player.riding ? '⏏' : 'E';
  // the slap charge ring round your character: green to yellow (slap), then shaking yellow to red (power slap)
  const ch = ix.charge;
  chargeEl.hidden = !ch;
  if (ch) {
    const [c1, c2] = CHARGE;
    const second = ch.t >= c1;
    const f = second ? Math.min(1, (ch.t - c1) / c2) : ch.t / c1;
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const col = second ? mix([255, 210, 63], [232, 64, 47], f) : mix([90, 200, 110], [255, 210, 63], f);
    chargeEl.style.setProperty('--col', `rgb(${col})`);
    chargeEl.style.setProperty('--deg', `${f * 360}deg`);
    chargeEl.classList.toggle('shake', second);
    const s = screenOf(c.player.root.position.clone().add(new THREE.Vector3(0, (c.player.height ?? 1.7) * 0.55, 0)), cam, W, H);
    chargeEl.style.left = `${s.x}px`;
    chargeEl.style.top = `${s.y}px`;
  }
  // a quick screen shake on a hit
  const sh = ix.shake ?? 0;
  canvas.style.transform = sh > 0 ? `translate(${(Math.random() - 0.5) * 14 * sh / 0.3}px, ${(Math.random() - 0.5) * 10 * sh / 0.3}px)` : '';
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
const timer = new THREE.Timer();
const gait = createGait(); // walk / run preview for the character creator
const catGait = createCatGait();
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight, pr = renderer.getPixelRatio();
  if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) renderer.setSize(w, h, false);
}
function preview(cell, r, H) {
  camera.aspect = r.w / r.h;
  if (reframe) {
    cell.setAngle(0);
    cell.frame(r.w / r.h, camera, { minHeight: 0 });
    controls.target.copy(cell.viewCenter);
    reframe = false;
  }
  camera.updateProjectionMatrix();
  controls.update();
  ps1.render(cell, camera, r.x, H - r.y - r.h, r.w, r.h);
}
function panelRect(panel, W, H) {
  const r = panel.getBoundingClientRect();
  if (panel.hidden || !r.width) return { x: 0, y: 0, w: W, h: H };
  return r.left > W * 0.3 ? { x: 0, y: 0, w: r.left, h: H } : { x: 0, y: 0, w: W, h: Math.max(80, r.top) };
}
function loop(time) {
  timer.update(time);
  resize();
  const dt = Math.min(timer.getDelta(), 0.1);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  renderer.setScissorTest(false);
  renderer.setClearColor(PAGE_BG);
  renderer.clear();
  if (state.view === 'item' && itemCell) {
    if (CATALOG[selected.id].animated === 'cat') {
      // walk / run in place: the cat's gait (anim/catGait.js)
      catGait.pose = { Sit: 'sit', Loaf: 'loaf', Sleep: 'sleep' }[state.itemAnim] ?? null;
      stepCatGait(catGait, dt, { Walk: CAT_WALK_SPEED, Run: CAT_RUN_SPEED }[state.itemAnim] ?? 0);
      itemCell.scene.traverse((o) => { if (o.name === 'cat') poseCat(o, catGait); });
    }
    preview(itemCell, panelRect(itemEl, W, H), H);
  }
  else if (state.view === 'creator') {
    stepGait(gait, dt, state.anim === 'Run' ? RUN_SPEED : state.anim === 'Walk' ? WALK_SPEED : 0);
    if (gait.lock != null) gait.phase = gait.lock * Math.PI * 2; // debug: freeze at a cycle fraction
    for (const p of humanCell.pivots) { const o = p.children[0]; if (o?.name === 'human') poseGait(o, gait); }
    preview(humanCell, creator.previewRect(W, H), H);
  } else if (state.view === 'city' && city) {
    // an error in one update must never stop the picture (the city would go black)
    try { city.update(dt, cityInput); } catch (err) { if (!loop.warned) { loop.warned = true; console.error('city update', err); } }
    city.setAspect(W / H);
    ps1.render(city, city.activeCamera, 0, 0, W, H);
    drawOverlay(city, W, H);
  }
  requestAnimationFrame(loop);
}

setView('catalog');
requestAnimationFrame(loop);

// Debug hooks for agents and tests (see SKILLS.md, "Testing and checking")
Object.assign(window, {
  __cc: {
    params, state, setView, openItem, CATALOG, human, getCity: () => ensureCity(), cityInput, gait,
    /** Set character settings (rules applied). */
    apply: (id, values) => { Object.assign(params[id], values); humanChanged(); reframe = true; },
    /**
     * Preview a comic hit variation (comedy.js) beside the player: kind
     * 'slap' | 'push' | 'fall', n 0-2, shown at time t; null clears it.
     */
    COMEDY,
    comedy: (kind, n = 0, t = 0) => {
      const c = ensureCity();
      if (!kind) { c.comedyStage?.dispose(); c.comedyStage = null; return null; }
      if (!c.comedyStage) {
        const p = c.player;
        c.comedyStage = new ComedyStage(c, (v) => c.buildPerson(v ? { ...params.human, ...human.randomize(Math.random) } : params.human), p.x + 1.5, p.z, 0);
      }
      c.comedyStage.play(kind, n);
      return c.comedyStage.at(t);
    },
    newTown: (seed) => { state.citySeed = seed; city = null; return ensureCity(); },
    /** Orbit the preview camera by `az` radians. */
    orbit: (az) => { const t = controls.target; camera.position.sub(t).applyAxisAngle(new THREE.Vector3(0, 1, 0), az).add(t); controls.update(); },
  },
});
