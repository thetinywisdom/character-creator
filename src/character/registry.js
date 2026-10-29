/**
 * Slot and part catalogue. A part build may hang meshes on sockets.
 * It does not create joints or move joint positions.
 */
export function createRegistry() {
  const sections = new Map();
  const slots = new Map();
  const sectionOrder = [];
  const slotOrder = [];

  return {
    registerSection(id, def = {}) {
      if (sections.has(id)) throw new Error(`section already registered: ${id}`);
      sections.set(id, {
        id,
        label: def.label || id,
        controls: (def.controls || []).map((control) => ({ ...control })),
        slots: [],
      });
      sectionOrder.push(id);
    },
    registerSlot(slot, def = {}) {
      if (slots.has(slot)) throw new Error(`slot already registered: ${slot}`);
      if (!def.section || !sections.has(def.section)) {
        throw new Error(`slot ${slot} needs a registered section`);
      }
      slots.set(slot, {
        id: slot,
        label: def.label || slot,
        section: def.section,
        parts: [],
      });
      slotOrder.push(slot);
      sections.get(def.section).slots.push(slot);
    },
    registerPart(slot, id, def = {}) {
      const entry = slots.get(slot);
      if (!entry) throw new Error(`unknown slot: ${slot}`);
      if (entry.parts.some((part) => part.id === id)) {
        throw new Error(`part already registered: ${slot}/${id}`);
      }
      entry.parts.push({
        slot,
        id,
        label: def.label || id,
        params: def.params || {},
        covers: def.covers ? [...def.covers] : [],
        build: typeof def.build === 'function' ? def.build : () => {},
      });
    },
    sections() {
      return sectionOrder.map((id) => {
        const section = sections.get(id);
        return {
          id: section.id,
          label: section.label,
          controls: section.controls.map((control) => ({ ...control })),
          slots: [...section.slots],
        };
      });
    },
    slots() {
      return slotOrder.map((id) => {
        const slot = slots.get(id);
        return { id: slot.id, label: slot.label, section: slot.section };
      });
    },
    parts(slot) {
      const entry = slots.get(slot);
      if (!entry) return [];
      return entry.parts.map((part) => ({ ...part, covers: [...part.covers] }));
    },
    has(slot, id) {
      return Boolean(slots.get(slot)?.parts.some((part) => part.id === id));
    },
    part(slot, id) {
      return slots.get(slot)?.parts.find((part) => part.id === id) || null;
    },
  };
}

const registry = createRegistry();

export function registerSection(id, def) {
  registry.registerSection(id, def);
}

export function registerSlot(slot, def) {
  registry.registerSlot(slot, def);
}

export function registerPart(slot, id, def) {
  registry.registerPart(slot, id, def);
}

export function getRegistry() {
  return registry;
}
