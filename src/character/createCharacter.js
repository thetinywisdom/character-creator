import { Object3D } from 'three';
import { createBody } from '../body/createBody.js';
import { getRegistry } from './registry.js';
import { defaultDocument, paramsFromDocument, validateDocument } from './schema.js';

const SOCKET_PARENT = {
  head: 'neck',
  back: 'waist',
  gripL: 'wristL',
  gripR: 'wristR',
  wristItemL: 'wristL',
  wristItemR: 'wristR',
};

const SLOT_VALUE = {
  'body.torso': (doc) => doc.body.torso,
  'head.shape': (doc) => doc.head.shape,
  'head.hair': (doc) => doc.head.hair.style,
  'head.facialHair': (doc) => doc.head.facialHair,
  'head.ears': (doc) => doc.head.ears,
  'head.earrings': (doc) => doc.head.earrings.id,
  'head.headwear': (doc) => doc.head.headwear.id,
  'head.eyewear': (doc) => doc.head.eyewear.id,
  'arms.left': (doc) => doc.arms.left.type,
  'arms.right': (doc) => doc.arms.right.type,
  'arms.left.hand': (doc) => doc.arms.left.hand,
  'arms.right.hand': (doc) => doc.arms.right.hand,
  'arms.left.wrist': (doc) => doc.arms.left.wrist.id,
  'arms.right.wrist': (doc) => doc.arms.right.wrist.id,
  'legs.left': (doc) => doc.legs.left.type,
  'legs.right': (doc) => doc.legs.right.type,
  'clothing.top': (doc) => doc.clothing.top.id,
  'clothing.outer': (doc) => doc.clothing.outer.id,
  'clothing.bottom': (doc) => doc.clothing.bottom.id,
  'clothing.shoes': (doc) => doc.clothing.shoes.id,
  back: (doc) => doc.back.id,
  'hands.left': (doc) => doc.held.left.id,
  'hands.right': (doc) => doc.held.right.id,
  'animation.dance': (doc) => doc.animation.dance,
  'animation.walkStyle': (doc) => doc.animation.walkStyle,
};

function makeSockets() {
  const sockets = {};
  for (const name of Object.keys(SOCKET_PARENT)) {
    const node = new Object3D();
    node.name = name;
    node.userData.socket = true;
    sockets[name] = node;
  }
  return sockets;
}

function attachSockets(body, sockets) {
  for (const [name, joint] of Object.entries(SOCKET_PARENT)) {
    body.joints[joint].add(sockets[name]);
  }
}

function runParts(body, doc, sockets) {
  delete body.root.userData.clothingBuilt;
  if (body.root.userData.layoutFresh) {
    body.root.userData.layoutFresh = false;
    delete body.root.userData.torsoStamp;
    delete body.root.userData.customTorso;
    for (const joint of Object.values(body.joints)) {
      delete joint.userData.partStamp;
      delete joint.userData.customArm;
      delete joint.userData.customLeg;
    }
  }
  const registry = getRegistry();
  const ctx = {
    spec: body.getResolved(),
    joints: body.joints,
    pelvis: body.pelvis,
    sockets,
    materials: body.materials,
    root: body.root,
    document: doc,
  };
  for (const slot of registry.slots()) {
    const id = SLOT_VALUE[slot.id](doc);
    const part = registry.part(slot.id, id);
    if (part) part.build({ ...ctx, slot: slot.id, id, part });
  }
}

function measureKey(doc) {
  return [
    doc.body.height,
    doc.body.shoulder,
    doc.body.belly,
    doc.body.hip,
    doc.body.limbThickness,
    doc.head.size,
  ].join('|');
}

function lookKey(doc) {
  return JSON.stringify({
    torso: doc.body.torso,
    arms: doc.arms,
    legs: doc.legs,
    clothing: doc.clothing,
    headwear: doc.head.headwear.id,
  });
}

function disposeBody(body) {
  body.root.traverse((obj) => {
    if (obj.isMesh && obj.geometry) obj.geometry.dispose();
    if (obj.skeleton?.boneTexture) obj.skeleton.boneTexture.dispose();
  });
  for (const material of body.materials) material.dispose();
}

function invalid(result) {
  const error = new Error(result.errors.join('\n'));
  error.errors = result.errors;
  return error;
}

/**
 * The mannequin from createBody, plus the saved document and empty sockets.
 * Part builds are registered and called. The default parts add no meshes,
 * so a default character stays at the naked vertex count.
 */
export function createCharacter(input) {
  const initial = input == null
    ? { ok: true, document: defaultDocument(), errors: [] }
    : validateDocument(input);
  if (!initial.ok) throw invalid(initial);

  let doc = initial.document;
  let current = null;
  const sockets = makeSockets();

  function mount(next) {
    const parent = current?.root.parent ?? null;
    const index = parent ? parent.children.indexOf(current.root) : -1;
    next.root.userData.layoutFresh = true;
    attachSockets(next, sockets);
    runParts(next, doc, sockets);
    if (parent) {
      parent.remove(current.root);
      parent.add(next.root);
      const at = parent.children.indexOf(next.root);
      if (index >= 0 && at !== index) {
        parent.children.splice(at, 1);
        parent.children.splice(index, 0, next.root);
      }
    }
    if (current) disposeBody(current);
    current = next;
  }

  function relayout() {
    current.setParams({});
    current.root.userData.layoutFresh = true;
    attachSockets(current, sockets);
    runParts(current, doc, sockets);
  }

  function syncParams(partial) {
    if (!partial || typeof partial !== 'object') return;
    if (typeof partial.height === 'number') doc.body.height = partial.height;
    if (typeof partial.shoulderWidth === 'number') doc.body.shoulder = partial.shoulderWidth;
    if (typeof partial.bellyWidth === 'number') doc.body.belly = partial.bellyWidth;
    if (typeof partial.hipWidth === 'number') doc.body.hip = partial.hipWidth;
    if (typeof partial.limbThickness === 'number') doc.body.limbThickness = partial.limbThickness;
    if (typeof partial.skinColor === 'string') doc.body.skin = partial.skinColor.toLowerCase();
    if (typeof partial.headSize === 'number') doc.head.size = partial.headSize;
  }

  mount(createBody(paramsFromDocument(doc)));

  return {
    sockets,
    get root() { return current.root; },
    get pelvis() { return current.pelvis; },
    get joints() { return current.joints; },
    get materials() { return current.materials; },
    update(dt, state) {
      const next = typeof state === 'string' ? { anim: state } : { ...(state || {}) };
      if (next.walkStyle == null) next.walkStyle = doc.animation.walkStyle;
      if (next.legs == null) {
        next.legs = { L: doc.legs.left.type, R: doc.legs.right.type };
      }
      current.update(dt, next);
    },
    setParams(partial) {
      const keys = partial && typeof partial === 'object' ? Object.keys(partial) : [];
      const skinOnly = keys.length > 0 && keys.every((key) => key === 'skinColor');
      current.setParams(partial);
      syncParams(partial);
      if (!skinOnly) {
        current.root.userData.layoutFresh = true;
        attachSockets(current, sockets);
        runParts(current, doc, sockets);
      }
    },
    getParams() { return current.getParams(); },
    getResolved() { return current.getResolved(); },
    getStats() { return current.getStats(); },
    getDocument() { return structuredClone(doc); },
    setDocument(next) {
      const result = validateDocument(next);
      if (!result.ok) throw invalid(result);
      const prev = doc;
      doc = result.document;
      const measures = measureKey(prev) !== measureKey(doc);
      const skin = prev.body.skin !== doc.body.skin;
      const look = lookKey(prev) !== lookKey(doc);
      if (measures) {
        mount(createBody(paramsFromDocument(doc)));
      } else {
        if (skin) current.setParams({ skinColor: doc.body.skin });
        if (look) relayout();
      }
      return structuredClone(doc);
    },
    updateDocument(mutate) {
      const next = structuredClone(doc);
      mutate(next);
      if (next.body.torso === 'robot') {
        next.clothing.top.id = 'none';
        next.clothing.outer.id = 'none';
      }
      return this.setDocument(next);
    },
    getRegistry() { return getRegistry(); },
  };
}
