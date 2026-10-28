// Comic palette (30 colours, 6 ramps dark -> light). Copied from iso-city.
// Character colours are sampled from the art and snapped to the palette where close.
export const COMIC = {
  blues: ['#203A57', '#2A5B94', '#3B7EE1', '#B0E9FF', '#DBF5FE'],
  pinks: ['#A92D59', '#FF5491', '#FF7DAF', '#F8C0C5', '#F9F0F1'],
  teals: ['#194A4C', '#198085', '#00B4BC', '#A8ECF2', '#EFFAFA'],
  warm: ['#4C3F42', '#93616B', '#DF9E89', '#F1CDC3', '#FCF0ED'],
  neutrals: ['#292C2E', '#363E47', '#5B6A7B', '#A7BFA4', '#F0F2F4'],
  yellows: ['#ED8F02', '#FFCC3F', '#FFE166', '#FFF3C1', '#FCF9EB'],
};

export const PALETTE = {
  peach: '#F1CDC3',   // main character skin   (art #ffdfd3 -> palette warm[3])
  orange: '#ED612B',  // main character line accents (art; no close palette match)
  npcSkin: '#B6C2CA', // NPC blue-grey skin    (art; no close palette match)
  npcLine: '#5B6A7B', // NPC lines, clips      (art #6e8091 -> neutrals[2])
  white: '#F0F2F4',   // shirts / coats / aprons (art #f1f2f4 -> neutrals[4])
  black: '#292C2E',   // tees, skirts, hair    (art #2b2c2e -> neutrals[0])
  slate: '#363E47',   // trousers, blouse, hair, glasses (art #333e48 -> neutrals[1])
};

/** The 30 Comic swatches, in ramp order. */
export const COLORS = Object.values(COMIC).flat();
