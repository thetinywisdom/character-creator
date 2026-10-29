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
  const registry = getRegistry();
  const ctx = {
    spec: body.getResolved(),
    joints: body.joints,
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

function disposeBody(body) {
  body.root.traverse((obj) => {
    if (obj.isMesh && obj.geometry) obj.geometry.dispose();
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

  function syncParams(partial) {
    if (!partial || typeof partial !== 'object') return;
    if (typeof partial.height === 'number') doc.body.height = partial.height;
    if (typeof partial.shoulderWidth === 'number') doc.body.shoulder = partial.shoulderWidth;
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
    update(dt, state) { current.update(dt, state); },
    setParams(partial) {
      current.setParams(partial);
      attachSockets(current, sockets);
      runParts(current, doc, sockets);
      syncParams(partial);
    },
    getParams() { return current.getParams(); },
    getResolved() { return current.getResolved(); },
    getStats() { return current.getStats(); },
    getDocument() { return structuredClone(doc); },
    setDocument(next) {
      const result = validateDocument(next);
      if (!result.ok) throw invalid(result);
      doc = result.document;
      mount(createBody(paramsFromDocument(doc)));
      return structuredClone(doc);
    },
    getRegistry() { return getRegistry(); },
  };
}
