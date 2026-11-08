import { deleteTown, getTown, listTowns, putTown } from './towns.js';

// "My towns": every town kept in this browser, newest first. Rename in place,
// open, duplicate or delete; start a new empty or sample town.

const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
};

export class TownsPanel {
  /** actions: open(id), newEmpty(), newSample(), currentId(), renamed(id, name) */
  constructor(actions) {
    this.actions = actions;
    const el = document.createElement('div');
    el.id = 'towns';
    el.hidden = true;
    el.innerHTML = `
      <div class="tw-sheet" role="dialog" aria-label="My towns">
        <div class="tw-head"><b>My towns</b><button data-act="close" title="Close">✕</button></div>
        <div class="tw-new">
          <button data-act="empty">＋ New empty town</button>
          <button data-act="sample">＋ New sample town</button>
        </div>
        <ul class="tw-list"></ul>
        <p class="tw-note">Towns are saved automatically in this browser. Use 💾 Save to keep a file copy.</p>
      </div>`;
    document.body.appendChild(el);
    this.el = el;
    const css = document.createElement('style');
    css.textContent = `
      #towns { position: fixed; inset: 0; z-index: 20; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; padding: 12px; }
      #towns[hidden] { display: none; }
      #towns .tw-sheet { width: min(560px, 100%); max-height: 86vh; display: flex; flex-direction: column; gap: 10px; background: #202227; color: #eee;
        border: 1px solid #3a3e45; border-radius: 14px; padding: 14px; font: 14px/1.3 system-ui, sans-serif; }
      #towns .tw-head { display: flex; justify-content: space-between; align-items: center; font-size: 17px; }
      #towns button { font: inherit; color: #eee; background: #33363d; border: 1px solid #4a4e57; border-radius: 9px; min-height: 44px; padding: 6px 12px; cursor: pointer; }
      #towns .tw-new { display: flex; gap: 8px; flex-wrap: wrap; }
      #towns .tw-new button { flex: 1; }
      #towns .tw-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
      #towns li { display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; padding: 10px; background: #2a2d33; border: 1px solid #3a3e45; border-radius: 10px; }
      #towns li.current { border-color: #f2b64a; }
      #towns li input { font: inherit; font-weight: 600; color: #eee; background: transparent; border: 1px solid transparent; border-radius: 6px; padding: 4px 6px; min-width: 0; }
      #towns li input:focus { border-color: #4a4e57; background: #1d1f23; outline: none; }
      #towns li small { grid-column: 1; color: #9aa0a8; padding-left: 6px; }
      #towns li .tw-acts { grid-column: 2; grid-row: 1 / span 2; display: flex; gap: 6px; align-items: center; }
      #towns .tw-note { margin: 0; color: #9aa0a8; font-size: 12px; }`;
    document.head.appendChild(css);
    el.addEventListener('click', async (e) => {
      if (e.target === el) return this.hide();
      const b = e.target.closest('button');
      if (!b) return;
      const id = b.closest('li')?.dataset.id;
      const act = b.dataset.act;
      if (act === 'close') this.hide();
      if (act === 'empty') { this.hide(); this.actions.newEmpty(); }
      if (act === 'sample') { this.hide(); this.actions.newSample(); }
      if (act === 'open') { this.hide(); this.actions.open(id); }
      if (act === 'copy') {
        const rec = await getTown(id);
        if (rec) await putTown({ name: `${rec.name} (copy)`, data: rec.data });
        this.render();
      }
      if (act === 'delete') {
        const name = b.closest('li').querySelector('input').value;
        if (id === this.actions.currentId()) return;
        if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
        await deleteTown(id);
        this.render();
      }
    });
    el.addEventListener('change', async (e) => {
      const input = e.target.closest('li input');
      if (!input) return;
      const id = input.closest('li').dataset.id;
      const rec = await getTown(id);
      const name = input.value.trim() || rec.name;
      if (rec) await putTown({ id, name, data: rec.data });
      this.actions.renamed(id, name);
    });
  }

  async render() {
    const towns = await listTowns();
    const cur = this.actions.currentId();
    const list = this.el.querySelector('.tw-list');
    list.replaceChildren(...towns.map((t) => {
      const li = document.createElement('li');
      li.dataset.id = t.id;
      li.classList.toggle('current', t.id === cur);
      const input = Object.assign(document.createElement('input'), { value: t.name, title: 'Rename' });
      const small = Object.assign(document.createElement('small'), { textContent: `${t.blocks} blocks · edited ${ago(t.updated)}${t.id === cur ? ' · open now' : ''}` });
      const acts = document.createElement('div');
      acts.className = 'tw-acts';
      acts.innerHTML = `${t.id === cur ? '' : '<button data-act="open">Open</button>'}<button data-act="copy" title="Duplicate">⧉</button>${t.id === cur ? '' : '<button data-act="delete" title="Delete">🗑</button>'}`;
      li.append(input, acts, small);
      return li;
    }));
  }

  show() { this.el.hidden = false; this.render(); }
  hide() { this.el.hidden = true; }
}
