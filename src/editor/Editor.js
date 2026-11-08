import * as THREE from 'three';
import { ASSETS, CATALOG } from '../catalog/index.js';
import { buildCity, buildObject } from '../city/build.js';
import { gridGeometry, BLOCK_TYPES } from '../city/format.js';
import { addObject, blockAt, cellAt, emptyCity, removeObject, resizeGrid, setBlock, updateObject } from '../city/edit.js';
import { setDetail } from '../lib/shapes.js';

// City editor: a top-down view of a city file with tools to paint blocks
// (roads join up round them by themselves), place assets from the catalogue,
// select / move / turn / delete things, undo and redo, change the grid size,
// and save, load or walk the result. Works with a mouse or touch:
//   one finger / left button  the current tool (pan, paint, place, select)
//   two fingers               pinch to zoom, drag to pan (any tool)
//   right or middle button    pan;  wheel: zoom

const TYPE_LABELS = { residential: 'Houses', mixed: 'Mixed', shops: 'Shops', downtown: 'Downtown', park: 'Park', plaza: 'Plaza' };
const TYPE_COLORS = { residential: '#9fc58a', mixed: '#e8c27a', shops: '#ef8f6b', downtown: '#8fb3e0', park: '#5fae5a', plaza: '#cfc6b0', erase: '#999' };
const SNAP = 0.5;
const snap = (v) => Math.round(v / SNAP) * SNAP;

export class Editor {
  /**
   * style: render style; canvas: the canvas to take pointer input from;
   * callbacks: onSave(data), onLoad() -> Promise<data|null>, onWalk(data),
   * onSample() -> data, toast(msg)
   */
  constructor({ style, canvas, data, callbacks }) {
    this.style = style;
    this.canvas = canvas;
    this.cb = callbacks;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(style.background);
    style.createLights({}).objects.forEach((o) => this.scene.add(o));
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
    this.view = { x: 0, z: 0, zoom: 90 }; // zoom = half the visible height, metres
    this.ground = null;
    this.built = new Map(); // city-file object -> built 3D object
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.overlay = new THREE.Group();
    this.scene.add(this.overlay);
    this.history = [];
    this.future = [];
    this.tool = 'paint';
    this.brush = 'residential';
    this.placeId = 'prop.bench';
    this.placeParams = {};
    this.placeRot = 0;
    this.selected = null;
    this.active = false;
    this.pointers = new Map();
    this.setData(data, { record: false });
    this.buildUI();
    this.bindInput();
  }

  // --- data & history ------------------------------------------------------
  setData(data, { record = true } = {}) {
    if (record && this.data) { this.history.push(this.data); this.future = []; if (this.history.length > 100) this.history.shift(); }
    const prev = this.data;
    this.data = data;
    if (this.selected && !data.objects.includes(this.selected)) this.selected = data.changed ?? null;
    delete data.changed;
    this.sync(prev);
    this.updateUI?.();
  }
  undo() { if (!this.history.length) return; this.future.push(this.data); const d = this.history.pop(); this.selected = null; this.setData(d, { record: false }); }
  redo() { if (!this.future.length) return; this.history.push(this.data); const d = this.future.pop(); this.selected = null; this.setData(d, { record: false }); }

  /** Rebuild what changed: the ground when blocks or grid change, and objects by identity. */
  sync(prev) {
    setDetail(this.style.detail ?? 1);
    if (!prev || prev.blocks !== this.data.blocks || prev.grid !== this.data.grid) {
      if (this.ground) this.root.remove(this.ground);
      this.ground = buildCity({ ...this.data, objects: [] }, this.style).group;
      this.root.add(this.ground);
      this.drawGrid();
    }
    const keep = new Set(this.data.objects);
    for (const [o, obj] of this.built) if (!keep.has(o)) { this.root.remove(obj); this.built.delete(o); }
    for (const o of this.data.objects) {
      if (this.built.has(o)) continue;
      const obj = buildObject(o, this.style);
      if (!obj) continue;
      this.style.decorate?.(obj);
      this.root.add(obj);
      this.built.set(o, obj);
    }
    setDetail(1);
    this.drawSelection();
  }

  // --- overlays ----------------------------------------------------------------
  drawGrid() {
    if (this.gridLines) this.overlay.remove(this.gridLines);
    const { grid } = this.data;
    const { blockRect } = gridGeometry(grid);
    const pts = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (blockAt(this.data, col, row)) continue; // empty cells get a dashed outline
        const r = blockRect(col, row);
        const y = 0.05;
        pts.push(r.x0, y, r.z0, r.x1, y, r.z0, r.x1, y, r.z0, r.x1, y, r.z1, r.x1, y, r.z1, r.x0, y, r.z1, r.x0, y, r.z1, r.x0, y, r.z0);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.gridLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    this.overlay.add(this.gridLines);
  }
  drawSelection() {
    if (this.selBox) { this.overlay.remove(this.selBox); this.selBox = null; }
    const obj = this.selected && this.built.get(this.selected);
    if (!obj) return;
    this.selBox = new THREE.BoxHelper(obj, 0xffd400);
    this.selBox.material.depthTest = false;
    this.overlay.add(this.selBox);
  }
  drawHover(cell) {
    if (this.hoverLine) { this.overlay.remove(this.hoverLine); this.hoverLine = null; }
    if (!cell || this.tool !== 'paint') return;
    const { grid } = this.data;
    if (cell.col < 0 || cell.row < 0 || cell.col >= grid.cols || cell.row >= grid.rows) return;
    const r = gridGeometry(grid).blockRect(cell.col, cell.row);
    const y = 0.3;
    const geo = new THREE.BufferGeometry().setFromPoints([[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1], [r.x0, r.z0]].map(([x, z]) => new THREE.Vector3(x, y, z)));
    this.hoverLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(TYPE_COLORS[this.brush]), depthTest: false }));
    this.overlay.add(this.hoverLine);
  }

  // --- camera ------------------------------------------------------------------
  updateCamera(aspect) {
    const { x, z, zoom } = this.view;
    const c = this.camera;
    c.left = -zoom * aspect; c.right = zoom * aspect; c.top = zoom; c.bottom = -zoom;
    // looking down at 60°, north (-z) at the top of the screen
    c.position.set(x, 600 * Math.sin(Math.PI / 3), z + 600 * Math.cos(Math.PI / 3));
    c.lookAt(x, 0, z);
    c.updateProjectionMatrix();
  }
  /** Fit the whole town on screen. */
  frameAll() {
    const { X, Z } = gridGeometry(this.data.grid);
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    // half the visible height: the ground is seen at 60°, so depth looks 0.87 × as long
    this.view = { x: 0, z: 0, zoom: Math.max(Z * 0.5 * Math.sin(Math.PI / 3), (X * 0.5) / aspect) * 1.05 + 4 };
  }
  /** Ground point (y = 0) under a screen point. */
  groundAt(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.updateCamera(r.width / r.height);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null;
  }
  /** The city object under a screen point (ignores the ground). */
  objectAt(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects([...this.built.values()], true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.cityObject) o = o.parent;
      const co = o?.userData.cityObject;
      if (co && co.asset !== 'ground.paving' && co.asset !== 'prop.crosswalk' && co.asset !== 'line.wire') return co;
    }
    return null;
  }

  // --- tools -------------------------------------------------------------------
  paintAt(p, stroke) {
    const cell = cellAt(this.data.grid, p.x, p.z);
    const { grid } = this.data;
    if (cell.col < 0 || cell.row < 0 || cell.col >= grid.cols || cell.row >= grid.rows) return;
    const key = `${cell.col},${cell.row}`;
    if (stroke.done.has(key)) return;
    stroke.done.add(key);
    const type = this.brush === 'erase' ? null : this.brush;
    const cur = blockAt(this.data, cell.col, cell.row);
    if (!type && !cur) return;
    // one undo step per stroke
    const next = setBlock(this.data, cell.col, cell.row, type);
    if (stroke.first) { stroke.first = false; this.setData(next); } // records the undo step
    else { const prev = this.data; this.data = next; this.sync(prev); }
  }
  placeAt(p) {
    const asset = CATALOG[this.placeId];
    const params = { ...this.placeParams };
    if (asset.category === 'building' || asset.category === 'area') params.seed = Math.floor(Math.random() * 1e9);
    if (asset.id === 'prop.crosswalk') params.length = this.data.grid.road;
    const o = { asset: asset.id, params, x: snap(p.x), z: snap(p.z), rot: this.placeRot };
    if (asset.category === 'vehicle' || asset.id === 'prop.crosswalk') {
      // on the road: sit at road height when not on a block
      const onBlock = blockAt(this.data, ...Object.values(cellAt(this.data.grid, p.x, p.z)));
      if (!onBlock || !this.insideBlock(p)) o.y = -this.data.grid.curb + (asset.id === 'prop.crosswalk' ? 0.001 : 0);
    }
    this.setData(addObject(this.data, o));
    this.selected = o;
    this.drawSelection();
  }
  insideBlock(p) {
    const { grid } = this.data;
    const c = cellAt(grid, p.x, p.z);
    if (!blockAt(this.data, c.col, c.row)) return false;
    const r = gridGeometry(grid).blockRect(c.col, c.row);
    return p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1;
  }
  rotateSelected() {
    if (!this.selected) return;
    this.setData(updateObject(this.data, this.selected, { rot: ((this.selected.rot ?? 0) + 90) % 360 }));
  }
  deleteSelected() {
    if (!this.selected) return;
    const s = this.selected;
    this.selected = null;
    this.setData(removeObject(this.data, s));
  }
  resize(dc, dr) {
    const g = this.data.grid;
    this.setData(resizeGrid(this.data, g.cols + dc, g.rows + dr));
  }

  // --- input -------------------------------------------------------------------
  bindInput() {
    const c = this.canvas;
    const pan = (dx, dy) => {
      const k = (this.view.zoom * 2) / c.clientHeight;
      this.view.x -= dx * k;
      this.view.z -= (dy * k) / Math.sin(Math.PI / 3); // the ground is foreshortened at 60°
    };
    c.addEventListener('contextmenu', (e) => { if (this.active) e.preventDefault(); });
    c.addEventListener('wheel', (e) => {
      if (!this.active) return;
      e.preventDefault();
      this.view.zoom = THREE.MathUtils.clamp(this.view.zoom * Math.exp(e.deltaY * 0.0012), 8, 400);
    }, { passive: false });
    c.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button });
      if (this.pointers.size === 2) { this.gesture = null; this.stroke = null; this.drag = null; return; }
      if (e.button === 1 || e.button === 2 || this.tool === 'pan') { this.gesture = 'pan'; return; }
      const p = this.groundAt(e.clientX, e.clientY);
      if (this.tool === 'paint' && p) { this.gesture = 'paint'; this.stroke = { done: new Set(), first: true }; this.paintAt(p, this.stroke); }
      else if (this.tool === 'place') this.gesture = 'tap';
      else if (this.tool === 'select') {
        const hit = this.objectAt(e.clientX, e.clientY);
        if (hit && hit === this.selected && p) { this.gesture = 'move'; this.drag = { start: p, x: hit.x, z: hit.z, moved: false }; }
        else if (hit) { this.selected = hit; this.drawSelection(); this.updateUI(); this.gesture = 'move'; this.drag = { start: p, x: hit.x, z: hit.z, moved: false }; }
        else { this.selected = null; this.drawSelection(); this.updateUI(); this.gesture = 'pan'; }
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      const pt = this.pointers.get(e.pointerId);
      if (!pt) { // hover
        if (this.tool === 'paint') { const p = this.groundAt(e.clientX, e.clientY); this.drawHover(p && cellAt(this.data.grid, p.x, p.z)); }
        return;
      }
      const dx = e.clientX - pt.x, dy = e.clientY - pt.y;
      pt.x = e.clientX; pt.y = e.clientY;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch) this.view.zoom = THREE.MathUtils.clamp(this.view.zoom * (this.pinch / dist), 8, 400);
        this.pinch = dist;
        pan(dx / 2, dy / 2);
        return;
      }
      if (this.gesture === 'pan') pan(dx, dy);
      else if (this.gesture === 'paint') { const p = this.groundAt(e.clientX, e.clientY); if (p) { this.paintAt(p, this.stroke); this.drawHover(cellAt(this.data.grid, p.x, p.z)); } }
      else if (this.gesture === 'move' && this.drag?.start) {
        const p = this.groundAt(e.clientX, e.clientY);
        if (!p) return;
        const obj = this.built.get(this.selected);
        if (!obj) return;
        this.drag.moved = true;
        obj.position.x = snap(this.drag.x + p.x - this.drag.start.x);
        obj.position.z = snap(this.drag.z + p.z - this.drag.start.z);
        this.selBox?.update();
      }
    });
    const end = (e) => {
      const pt = this.pointers.get(e.pointerId);
      if (!pt) return;
      this.pointers.delete(e.pointerId);
      this.pinch = null;
      if (this.pointers.size) return;
      const tap = Math.hypot(e.clientX - pt.sx, e.clientY - pt.sy) < 8;
      if (this.gesture === 'tap' && tap) { const p = this.groundAt(e.clientX, e.clientY); if (p) this.placeAt(p); }
      if (this.gesture === 'move' && this.drag?.moved) {
        const obj = this.built.get(this.selected);
        this.setData(updateObject(this.data, this.selected, { x: obj.position.x, z: obj.position.z }));
      }
      this.gesture = null; this.stroke = null; this.drag = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    window.addEventListener('keydown', (e) => {
      if (!this.active || e.target.closest?.('input, select, textarea')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); this.redo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') this.deleteSelected();
      else if (e.key.toLowerCase() === 'r') { if (this.tool === 'place') { this.placeRot = (this.placeRot + 90) % 360; this.updateUI(); } else this.rotateSelected(); }
    });
  }

  // --- UI ----------------------------------------------------------------------
  buildUI() {
    const el = document.createElement('div');
    el.id = 'editor-ui';
    el.hidden = true;
    el.innerHTML = `
      <div class="ed-row ed-tools">
        <button data-tool="pan" title="Pan (or drag with two fingers / right button)">✋ Pan</button>
        <button data-tool="paint">▦ Blocks</button>
        <button data-tool="place">＋ Place</button>
        <button data-tool="select">⬚ Select</button>
        <span class="ed-sep"></span>
        <button data-act="undo" title="Undo (Ctrl+Z)">↶</button>
        <button data-act="redo" title="Redo (Ctrl+Shift+Z)">↷</button>
        <span class="ed-sep"></span>
        <button data-act="walk" class="ed-primary">🚶 Walk it</button>
        <button data-act="menu" title="File and grid">☰</button>
      </div>
      <div class="ed-row ed-ctx" data-for="paint"></div>
      <div class="ed-row ed-ctx" data-for="place">
        <select data-k="asset"></select>
        <select data-k="variant"></select>
        <select data-k="color"></select>
        <button data-act="rotPlace" title="Turn (R)">⟳ <span data-k="rot"></span>°</button>
        <span class="ed-hint">Tap the map to place</span>
      </div>
      <div class="ed-row ed-ctx" data-for="select">
        <span class="ed-hint" data-k="selName">Tap something to select it, drag it to move</span>
        <button data-act="rotSel" title="Turn (R)">⟳ Turn</button>
        <button data-act="delSel" title="Delete">🗑 Delete</button>
      </div>
      <div class="ed-row ed-menu" hidden>
        <span>Grid <b data-k="gridSize"></b></span>
        <button data-act="cols-">− col</button><button data-act="cols+">+ col</button>
        <button data-act="rows-">− row</button><button data-act="rows+">+ row</button>
        <span class="ed-sep"></span>
        <button data-act="new">New empty</button>
        <button data-act="sample">Sample town</button>
        <button data-act="save">Save file</button>
        <button data-act="load">Load file</button>
        <button data-act="fit">Fit view</button>
      </div>`;
    document.body.appendChild(el);
    this.ui = el;
    const css = document.createElement('style');
    css.textContent = `
      #editor-ui { position: fixed; left: 8px; right: 8px; bottom: 8px; z-index: 5; display: flex; flex-direction: column; gap: 6px;
        font: 13px/1.2 system-ui, sans-serif; pointer-events: none; }
      #editor-ui[hidden] { display: none; }
      #editor-ui .ed-row { pointer-events: auto; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; align-self: center;
        background: rgba(24,24,28,.86); color: #eee; padding: 6px; border-radius: 10px; max-width: 100%; }
      #editor-ui .ed-row[hidden] { display: none; }
      #editor-ui button, #editor-ui select { font: inherit; color: #eee; background: #3a3a42; border: 1px solid #55555e; border-radius: 8px;
        padding: 7px 10px; min-height: 36px; cursor: pointer; }
      #editor-ui select { max-width: 46vw; }
      #editor-ui button.on { background: #f2c230; color: #1d1d1d; border-color: #f2c230; }
      #editor-ui .ed-primary { background: #2f7d4f; border-color: #3c9a62; }
      #editor-ui .ed-sep { width: 1px; align-self: stretch; background: #55555e; }
      #editor-ui .ed-hint { color: #aaa; padding: 0 4px; }
      #editor-ui .chip { display: inline-flex; gap: 6px; align-items: center; }
      #editor-ui .chip i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }`;
    document.head.appendChild(css);

    // block brush chips
    const paint = el.querySelector('[data-for="paint"]');
    for (const t of [...BLOCK_TYPES, 'erase']) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.dataset.brush = t;
      b.innerHTML = `<i style="background:${TYPE_COLORS[t]}"></i>${t === 'erase' ? 'Erase' : TYPE_LABELS[t]}`;
      paint.appendChild(b);
    }
    const hint = document.createElement('span');
    hint.className = 'ed-hint';
    hint.textContent = 'Tap or drag over cells · same type again = new layout';
    paint.appendChild(hint);

    // asset list, grouped by category
    const sel = el.querySelector('[data-k="asset"]');
    const CATS = { building: 'Buildings', area: 'Areas', prop: 'Street props', vehicle: 'Vehicles', ground: 'Ground' };
    for (const [cat, label] of Object.entries(CATS)) {
      const og = document.createElement('optgroup');
      og.label = label;
      for (const a of ASSETS.filter((a) => a.category === cat)) og.appendChild(new Option(a.label, a.id));
      sel.appendChild(og);
    }
    sel.value = this.placeId;
    const setAsset = (id) => {
      this.placeId = id;
      const a = CATALOG[id];
      this.placeParams = { ...a.params };
      const fill = (k, list) => {
        const s = el.querySelector(`[data-k="${k}"]`);
        s.replaceChildren(...(list ?? []).map((v) => new Option(v, v)));
        s.hidden = !list || list.length < 2;
      };
      fill('variant', a.variants);
      fill('color', a.colors);
    };
    setAsset(this.placeId);
    sel.addEventListener('change', () => { setAsset(sel.value); this.updateUI(); });
    el.querySelector('[data-k="variant"]').addEventListener('change', (e) => { this.placeParams.variant = e.target.value; });
    el.querySelector('[data-k="color"]').addEventListener('change', (e) => { this.placeParams.color = e.target.value; });

    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.tool) { this.tool = b.dataset.tool; this.drawHover(null); }
      if (b.dataset.brush) this.brush = b.dataset.brush;
      const act = b.dataset.act;
      const g = this.data.grid;
      if (act === 'undo') this.undo();
      if (act === 'redo') this.redo();
      if (act === 'menu') el.querySelector('.ed-menu').hidden = !el.querySelector('.ed-menu').hidden;
      if (act === 'rotPlace') this.placeRot = (this.placeRot + 90) % 360;
      if (act === 'rotSel') this.rotateSelected();
      if (act === 'delSel') this.deleteSelected();
      if (act === 'cols-') this.resize(-1, 0);
      if (act === 'cols+') this.resize(1, 0);
      if (act === 'rows-') this.resize(0, -1);
      if (act === 'rows+') this.resize(0, 1);
      if (act === 'new') { this.selected = null; this.setData(emptyCity(g.cols, g.rows)); }
      if (act === 'sample') { this.selected = null; this.setData(this.cb.onSample()); this.frameAll(); }
      if (act === 'save') this.cb.onSave(this.data);
      if (act === 'load') { const d = await this.cb.onLoad(); if (d) { this.selected = null; this.setData(d); this.frameAll(); } }
      if (act === 'fit') this.frameAll();
      if (act === 'walk') this.cb.onWalk(this.data);
      this.updateUI();
    });
    this.updateUI();
  }

  updateUI() {
    const el = this.ui;
    if (!el) return;
    el.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === this.tool));
    el.querySelectorAll('[data-brush]').forEach((b) => b.classList.toggle('on', b.dataset.brush === this.brush));
    el.querySelectorAll('.ed-ctx').forEach((r) => { r.hidden = r.dataset.for !== this.tool; });
    el.querySelector('[data-act="undo"]').disabled = !this.history.length;
    el.querySelector('[data-act="redo"]').disabled = !this.future.length;
    el.querySelector('[data-k="rot"]').textContent = this.placeRot;
    el.querySelector('[data-k="gridSize"]').textContent = `${this.data.grid.cols} × ${this.data.grid.rows}`;
    const s = this.selected;
    el.querySelector('[data-k="selName"]').textContent = s ? `${CATALOG[s.asset]?.label ?? s.asset}${s.params?.variant ? ' · ' + s.params.variant : ''}` : 'Tap something to select it, drag it to move';
    el.querySelector('[data-act="rotSel"]').hidden = !s;
    el.querySelector('[data-act="delSel"]').hidden = !s;
  }

  show(on) {
    this.active = on;
    this.ui.hidden = !on;
    if (!on) { this.pointers.clear(); this.drawHover(null); }
  }
}
