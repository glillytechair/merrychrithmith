// ============================================================================
//  WREATH QUEST: Quest for the Head
//  A very small catch game. The drawing is Althea's and is used unedited:
//  the game only ever draws rectangles cropped out of the original PNG.
// ============================================================================
(() => {
'use strict';

// ---------------------------------------------------------------------------
//  >>> EDIT THESE <<<
//  PERSONAL_NOTE is shown on every end screen, in a box of its own.
//  The font covers plain ASCII (letters, digits, common punctuation).
// ---------------------------------------------------------------------------
const PERSONAL_NOTE =
  'Merry Chrithmith.\nThe wreath was in the right place the whole time.\nReading this counts as two things at once.';
const ART_CREDIT = 'Drawing by Althea';
// ---------------------------------------------------------------------------

// ----- Tuning ---------------------------------------------------------------
const PERFECT_DAY = 1080;        // XP for a perfect day. 1 minute = 1 XP.
const XP_PER_LEVEL = 108;        // ten levels to a perfect day
const START_UNDOS = 3;           // Paint only ever had three
const RAMP_SECONDS = 170;        // seconds until difficulty maxes out
const XP_GOOD = 5;
const XP_STEAK = 6;
const XP_WREATH = 10;
const STACK_BONUS = 50;          // flat XP, no multiplier, the moment the fifth wreath lands
const DOUBLE_WINDOW_MS = 140;    // two catches this close together = two things at once
const BANNER_LINGER = 1;         // extra seconds every pop-up banner and achievement toast stays on screen
const MUSIC_LEVEL = 0.44;        // gain of the Paint music bus
const LAND_FX = 0.45;            // seconds the portrait's selection flashes after a wreath lands
const PERFECT_ZONE = 0.8;        // share of the head zone, out from the stack's center, where a wreath lands; beyond it the wreath bounces
const EDGE_SLOP = 0.3;           // how far past the head zone a wreath still bounces off instead of falling on to a border
const STORM_X2 = 20;             // storm count for x2
const STORM_X3 = 25;             // storm count for x3 ("infinite")
const SPAWN_START = 1.25, SPAWN_END = 0.38;     // seconds between spawns
const WARMUP_HOLD = 10, WARMUP_END = 30;        // seconds: spawns stay sparse until the hold ends, then ease to normal
const WARMUP_SPACING = 2;                        // multiplier on the time between spawns during the hold
const FALL_START = 140, FALL_END = 360;         // px per second
const BAD_START = 0.20, BAD_END = 0.30;         // share of spawns that are bad
const BAD_INSET = 26;                            // bad items only count if they hit the body, not the selection edge
const CATCH_BAND = 56;                           // px below the portrait's top in which a falling thing can land on it
const PAIR_START = 0.05, PAIR_END = 0.45;       // share of spawns that come as a pair
const WREATH_SHARE = 0.15;                      // share of non-bad spawns that are wreaths
const RARE_CARD_SHARE = 1 / 3;                  // share of Magic cards that are rare: gold border, worth more
const RARE_CARD_MULT = 3;                       // a rare card pays this many ordinary cards
const MOUSE_SPEED = 1700, KEY_SPEED = 620;      // px per second

// ----- Layout (all in logical pixels; the canvas is scaled with CSS) --------
const PLAY_W = 800, PLAY_H = 600;   // the 4:3 "image" inside Paint
const FRAME = 4, TITLE_H = 22, MENU_H = 22, TOOLS_W = 58, PAD = 6;
const PALETTE_H = 44, STATUS_H = 22;
const PLAY_X = FRAME + TOOLS_W + PAD;
const PLAY_Y = FRAME + TITLE_H + MENU_H + PAD;
const WIN_W = PLAY_X + PLAY_W + PAD + FRAME;
const WIN_H = PLAY_Y + PLAY_H + PAD + PALETTE_H + STATUS_H + FRAME;
const PALETTE_Y = PLAY_Y + PLAY_H + PAD;
const STATUS_Y = PALETTE_Y + PALETTE_H;

// ----- Her drawing: crop rectangles in source pixels -------------------------
const CROP = { x: 540, y: 296, w: 500, h: 523 };   // the portrait
const PORTRAIT_H = 200;                             // sprite height in play pixels
const HEAD_L = 0.12, HEAD_R = 0.64;                 // head zone, fraction of sprite width
const HEAD_CX = 0.375;                              // center of the drawn wreath
const SHOULDER = 0.715;                             // where the shirt starts, fraction of height

// ----- Palette: everything that is not her drawing ---------------------------
const BLACK = '#000000', DARK = '#808080', LIGHT = '#c0c0c0', WHITE = '#ffffff', MID = '#404040';
const GOLD = '#d4af37';   // the one color among the sprites: the border of a rare card
// Toolbox buttons that respond when clicked (index = position, left to right, top to bottom). The rest do nothing at all.
const TOOL_MSGS: Record<number, string> = {
  1: 'The Select tool is in use.',
  2: 'The eraser is not an undo. You have three.',
  3: 'The bucket is empty.',
  4: 'Picked color: black, as expected.',
  5: 'Zoom: 100%. Things are the size they are.',
  8: 'The airbrush hissed. Nothing came out.',
  14: 'An ellipse is a wreath that did nothing.',
};
const TOOLS_TO_FIND = 5;                 // distinct responding tools clicked for the achievement
const toolsFound = new Set<number>();    // this visit only; they are quick to find again

type Phase = 'title' | 'howto' | 'playing' | 'dying' | 'over' | 'won';
type Kind = 'wreath' | 'pellegrino' | 'card' | 'heart' | 'steak' | 'dasani' | 'counterspell' | 'beach' | 'comforter' | 'sugar';

// ============================================================================
//  Bitmap font: 5x7, drawn with rectangles, never anti-aliased
// ============================================================================
const FONT: Record<string, string> = {
  'A': '01110/10001/10001/11111/10001/10001/10001', 'B': '11110/10001/10001/11110/10001/10001/11110',
  'C': '01110/10001/10000/10000/10000/10001/01110', 'D': '11110/10001/10001/10001/10001/10001/11110',
  'E': '11111/10000/10000/11110/10000/10000/11111', 'F': '11111/10000/10000/11110/10000/10000/10000',
  'G': '01110/10001/10000/10111/10001/10001/01111', 'H': '10001/10001/10001/11111/10001/10001/10001',
  'I': '01110/00100/00100/00100/00100/00100/01110', 'J': '00111/00010/00010/00010/00010/10010/01100',
  'K': '10001/10010/10100/11000/10100/10010/10001', 'L': '10000/10000/10000/10000/10000/10000/11111',
  'M': '10001/11011/10101/10101/10001/10001/10001', 'N': '10001/10001/11001/10101/10011/10001/10001',
  'O': '01110/10001/10001/10001/10001/10001/01110', 'P': '11110/10001/10001/11110/10000/10000/10000',
  'Q': '01110/10001/10001/10001/10101/10010/01101', 'R': '11110/10001/10001/11110/10100/10010/10001',
  'S': '01111/10000/10000/01110/00001/00001/11110', 'T': '11111/00100/00100/00100/00100/00100/00100',
  'U': '10001/10001/10001/10001/10001/10001/01110', 'V': '10001/10001/10001/10001/10001/01010/00100',
  'W': '10001/10001/10001/10101/10101/10101/01010', 'X': '10001/10001/01010/00100/01010/10001/10001',
  'Y': '10001/10001/10001/01010/00100/00100/00100', 'Z': '11111/00001/00010/00100/01000/10000/11111',
  'a': '00000/00000/01110/00001/01111/10001/01111', 'b': '10000/10000/10110/11001/10001/10001/11110',
  'c': '00000/00000/01110/10000/10000/10001/01110', 'd': '00001/00001/01101/10011/10001/10001/01111',
  'e': '00000/00000/01110/10001/11111/10000/01110', 'f': '00110/01001/01000/11100/01000/01000/01000',
  'g': '00000/01111/10001/10001/01111/00001/01110', 'h': '10000/10000/10110/11001/10001/10001/10001',
  'i': '00100/00000/01100/00100/00100/00100/01110', 'j': '00010/00000/00110/00010/00010/10010/01100',
  'k': '10000/10000/10010/10100/11000/10100/10010', 'l': '01100/00100/00100/00100/00100/00100/01110',
  'm': '00000/00000/11010/10101/10101/10001/10001', 'n': '00000/00000/10110/11001/10001/10001/10001',
  'o': '00000/00000/01110/10001/10001/10001/01110', 'p': '00000/00000/11110/10001/11110/10000/10000',
  'q': '00000/00000/01101/10011/01111/00001/00001', 'r': '00000/00000/10110/11001/10000/10000/10000',
  's': '00000/00000/01110/10000/01110/00001/11110', 't': '01000/01000/11100/01000/01000/01001/00110',
  'u': '00000/00000/10001/10001/10001/10011/01101', 'v': '00000/00000/10001/10001/10001/01010/00100',
  'w': '00000/00000/10001/10001/10101/10101/01010', 'x': '00000/00000/10001/01010/00100/01010/10001',
  'y': '00000/00000/10001/10001/01111/00001/01110', 'z': '00000/00000/11111/00010/00100/01000/11111',
  '0': '01110/10001/10011/10101/11001/10001/01110', '1': '00100/01100/00100/00100/00100/00100/01110',
  '2': '01110/10001/00001/00010/00100/01000/11111', '3': '11111/00010/00100/00010/00001/10001/01110',
  '4': '00010/00110/01010/10010/11111/00010/00010', '5': '11111/10000/11110/00001/00001/10001/01110',
  '6': '00110/01000/10000/11110/10001/10001/01110', '7': '11111/00001/00010/00100/01000/01000/01000',
  '8': '01110/10001/10001/01110/10001/10001/01110', '9': '01110/10001/10001/01111/00001/00010/01100',
  ' ': '00000/00000/00000/00000/00000/00000/00000', '.': '00000/00000/00000/00000/00000/01100/01100',
  ',': '00000/00000/00000/00000/01100/00100/01000', ':': '00000/01100/01100/00000/01100/01100/00000',
  ';': '00000/01100/01100/00000/01100/00100/01000', '!': '00100/00100/00100/00100/00100/00000/00100',
  '?': '01110/10001/00001/00010/00100/00000/00100', "'": '00100/00100/00000/00000/00000/00000/00000',
  '"': '01010/01010/00000/00000/00000/00000/00000', '-': '00000/00000/00000/11111/00000/00000/00000',
  '+': '00000/00100/00100/11111/00100/00100/00000', '/': '00001/00001/00010/00100/01000/10000/10000',
  '(': '00010/00100/01000/01000/01000/00100/00010', ')': '01000/00100/00010/00010/00010/00100/01000',
  '[': '01110/01000/01000/01000/01000/01000/01110', ']': '01110/00010/00010/00010/00010/00010/01110',
  '=': '00000/00000/11111/00000/11111/00000/00000', '<': '00010/00100/01000/10000/01000/00100/00010',
  '>': '01000/00100/00010/00001/00010/00100/01000', '_': '00000/00000/00000/00000/00000/00000/11111',
  '%': '11001/11010/00010/00100/01000/01011/10011', '#': '01010/01010/11111/01010/11111/01010/01010',
  '&': '01100/10010/10100/01000/10101/10010/01101', '*': '00000/00100/10101/01110/10101/00100/00000',
  '×': '00000/10001/01010/00100/01010/10001/00000', '→': '00000/00100/00010/11111/00010/00100/00000',
  '←': '00000/00100/01000/11111/01000/00100/00000', '↑': '00100/01110/10101/00100/00100/00100/00100',
  '↓': '00100/00100/00100/00100/10101/01110/00100', '∞': '00000/00000/01010/10101/10101/01010/00000',
  '✓': '00000/00001/00010/10100/01000/00000/00000', '□': '11111/10001/10001/10001/10001/10001/11111',
};
const glyphCache = new Map<string, HTMLCanvasElement>();
function glyph(ch: string, scale: number, color: string): HTMLCanvasElement {
  const key = ch + '|' + scale + '|' + color;
  let c = glyphCache.get(key);
  if (c) return c;
  const rows = (FONT[ch] ?? FONT['□']).split('/');
  c = document.createElement('canvas');
  c.width = 5 * scale; c.height = 7 * scale;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (rows[y][x] === '1') g.fillRect(x * scale, y * scale, scale, scale);
  glyphCache.set(key, c);
  return c;
}
function textW(s: string, scale: number): number { return s.length ? s.length * 6 * scale - scale : 0; }
function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, scale: number, color: string, align: 'left' | 'center' | 'right' = 'left'): void {
  const w = textW(s, scale);
  let cx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  const cy = Math.round(y);
  for (const ch of s) { g.drawImage(glyph(ch, scale, color), cx, cy); cx += 6 * scale; }
}
/** Text with a white halo so it stays legible on top of sprites. */
function textHalo(g: CanvasRenderingContext2D, s: string, x: number, y: number, scale: number, color: string, align: 'left' | 'center' | 'right' = 'left'): void {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) text(g, s, x + dx, y + dy, scale, WHITE, align);
  text(g, s, x, y, scale, color, align);
}
function wrap(s: string, maxW: number, scale: number): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const trial = line ? line + ' ' + word : word;
      if (textW(trial, scale) <= maxW || !line) line = trial; else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

// ============================================================================
//  Sprites: ASCII art rendered to small canvases at 3x
// ============================================================================
const SPR = 3;
const INK: Record<string, string> = { '#': BLACK, 'w': WHITE, 'g': DARK, 'l': LIGHT, 'd': MID, 'y': GOLD };
function spriteFromRows(rows: string[]): HTMLCanvasElement {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const c = document.createElement('canvas');
  c.width = w * SPR; c.height = h * SPR;
  const g = c.getContext('2d')!;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ink = INK[rows[y][x] ?? '.'];
    if (ink) { g.fillStyle = ink; g.fillRect(x * SPR, y * SPR, SPR, SPR); }
  }
  return c;
}
function wreathRows(): string[] {
  // A ring with leaf bumps and berries, generated so it is at least symmetrical-ish.
  const N = 18, cx = 9, cy = 9;
  const body: boolean[][] = [];
  for (let y = 0; y < N; y++) { body.push([]); for (let x = 0; x < N; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const bump = Math.sin(a * 7) > 0.35 ? 0.9 : 0;
    body[y].push(d >= 4.4 && d <= 7.3 + bump);
  } }
  const rows: string[] = [];
  for (let y = 0; y < N; y++) {
    let r = '';
    for (let x = 0; x < N; x++) {
      if (!body[y][x]) { r += '.'; continue; }
      const edge = !(body[y - 1]?.[x]) || !(body[y + 1]?.[x]) || !body[y][x - 1] || !body[y][x + 1];
      if (edge) { r += '#'; continue; }
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
      const fr = ((a * 3 / Math.PI) % 1 + 1) % 1;                         // 0..1 between berry slots; 0.5 is a berry
      const berry = Math.abs(fr - 0.5) < 0.12 && Math.abs(d - 5.9) < 0.6;
      const halo = Math.abs(fr - 0.5) < 0.17 && Math.abs(d - 5.9) < 1.0;  // a light sheen around each berry
      const fleck = (x * 5 + y * 3) % 11 === 0;                            // frost on the leaves
      r += berry ? 'w' : (halo || fleck) ? 'l' : (((x * 3 + y * 5) % 7 === 0) ? 'd' : 'g');
    }
    rows.push(r);
  }
  return rows;
}
const ART: Record<Kind, string[]> = {
  wreath: wreathRows(),
  pellegrino: [
    '...###...', '...#g#...', '...#w#...', '...#w#...', '..##w##..', '.#wwwww#.', '.#wwwww#.', '.#ddddd#.',
    '.#ddwdd#.', '.#dwwwd#.', '.#ddwdd#.', '.#ddddd#.', '.#wwwww#.', '.#wwwww#.', '.#wwwww#.', '..#####..',
  ],
  card: [
    '.#########.', '#ddddddddd#', '#d#######d#', '#d#ggggg#d#', '#d#g###g#d#', '#d#g#w#g#d#', '#d#g###g#d#',
    '#d#ggggg#d#', '#d#######d#', '#d#ggggg#d#', '#d#######d#', '#d#ggggg#d#', '#d#######d#', '#ddddddddd#', '.#########.',
  ],
  heart: [
    '..###...###..', '.#####.#####.', '#############', '#############', '#w###########', '#############',
    '.###########.', '..#########..', '...#######...', '....#####....', '.....###.....', '......#......',
  ],
  steak: [
    '....######......', '..##wwwwww##....', '.#wwgggggg#w##..', '#gg#gggg#ggggw#.', '#g#gggg#gggg#g#.', '#gggg#gggg#ggg#.',
    '.#gg#gggg#ggg#..', '.#gggggg#ggg#...', '..#ggg#ggggg#...', '...##gggggg#....', '.....######.....',
  ],
  dasani: [
    '.w.w.w.w.w.', 'w.w.w.w.w.w', '.w.w.w.w.w.', '...#####...', '..#wwwww#..', '.#wwwwwww#.', '#wwwwwwwww#', '###########',
    '#w#w#w#w#w#', '#w#w#w#w#w#', '###########', '#w#w#w#w#w#', '###########', '#wwwwwwwww#', '#wwwwwwwww#', '.#########.',
  ],
  counterspell: [
    '.#########.', '#wwwwwwwww#', '#w#wwwww#w#', '#ww#www#ww#', '#www#w#www#', '#wwww#wwww#', '#www#w#www#', '#ww#www#ww#',
    '#w#wwwww#w#', '#wwwwwwwww#', '#w#######w#', '#wwwwwwwww#', '#w#######w#', '#wwwwwwwww#', '.#########.',
  ],
  beach: [
    '.....#######....', '....##g#w#g##...', '..#w#g#w#g#w#g#.', '.#w#g#w#g#w#g#w#', '.###############', '........#.......',
    '........#.......', '........#.......', '........#.......', '......#####.....', '....##lllll##...', '..##lll#lll#l##.',
    '.#lll#llllll#ll#', '#llllllll#llllll', '################',
  ],
  comforter: [
    '..##############..', '.#llllllllllllll#.', '#l#llll#llll#llll#', '#ll#ll#ll#ll#ll#l#', '#lll##llll##llll##', '#ll#ll#ll#ll#ll#l#',
    '#l#llll#llll#llll#', '#llllllllllllllll#', '#l#llll#llll#llll#', '#ll#ll#ll#ll#ll#l#', '.#llllllllll##ww#.', '..############ww#.',
  ],
  sugar: [   // three cubes
    '....#######...', '....#wwwwl#...', '....#wwwwl#...', '....#wwwwl#...', '....#wwwwl#...', '....#lllll#...',
    '##############', '#wwwwl##wwwwl#', '#wwwwl##wwwwl#', '#wwwwl##wwwwl#', '#wwwwl##wwwwl#', '#wwwwl##wwwwl#',
    '#lllll##lllll#', '##############',
  ],
};
const SPRITES = {} as Record<Kind, HTMLCanvasElement>;
// A rare card is the ordinary card inside a one-cell gold frame.
const rareCard = spriteFromRows(['y'.repeat(ART.card[0].length + 2), ...ART.card.map(r => 'y' + r + 'y'), 'y'.repeat(ART.card[0].length + 2)]);
(Object.keys(ART) as Kind[]).forEach(k => { SPRITES[k] = spriteFromRows(ART[k]); });

interface KindInfo { good: boolean; label: string; xp: number; bad?: string[]; death?: string; }
const KINDS: Record<Kind, KindInfo> = {
  wreath:     { good: true, label: 'WREATH', xp: XP_WREATH },
  pellegrino: { good: true, label: 'S.PELLEGRINO', xp: XP_GOOD },
  card:       { good: true, label: 'MAGIC CARD', xp: XP_GOOD },
  heart:      { good: true, label: 'BLACK HEART', xp: XP_GOOD },
  steak:      { good: true, label: 'STEAK', xp: XP_STEAK },
  dasani:     { good: false, label: 'DASANI', xp: 0,
    bad: ['Dasani. Hydrated incorrectly.', 'That is Dasani. Technically water.'],
    death: 'You drank the Dasani. It was, technically, water. You have died.' },
  counterspell: { good: false, label: 'COUNTERSPELL', xp: 0,
    bad: ['Counterspell.', 'Countered. It was going so well.', 'Counterspell. Someone always has it.'],
    death: 'Someone had the Counterspell. Someone always has the Counterspell. You have died, on the stack.' },
  beach:      { good: false, label: 'THE BEACH', xp: 0,
    bad: ['The beach. No.', 'Beach. Sand in everything.', 'The beach. Bright, loud, and wet.'],
    death: 'You went to the beach. It was bright, and there was sand in everything. You have died.' },
  comforter:  { good: false, label: 'POLYESTER COMFORTER', xp: 0,
    bad: ['100% polyester. 0% acceptable.', 'Polyester. It crackles.', 'The comforter does not breathe.'],
    death: 'You have died under a polyester comforter. It did not breathe. Neither, now, do you.' },
  sugar:      { good: false, label: 'SUGAR', xp: 0,
    bad: ['Sugar. Processed. Next.'],
    death: 'Sugar got you. It was, as described, sweet. You have died.' },
};
const BORDER_MSGS = [
  'Wreath around the portrait. A border. Wrong.',
  'That is what the viewer meant. That is the problem.',
  'A border. Technically requested. Incorrect.',
];
const BORDER_DEATH = 'The viewer got his border. You got this screen. Restore? There is nothing to restore.';
const BAD_KINDS: Kind[] = ['dasani', 'counterspell', 'beach', 'comforter', 'sugar'];

// ============================================================================
//  Achievements
// ============================================================================
const ACH: Record<string, string> = {
  literal: 'Took the instructions literally',
  hydrated: 'Hydrated correctly',
  card: 'Drew a card',
  heart: 'Heart in the correct color',
  steak: 'Medium rare',
  two: 'Two things at once',
  infinite: 'Went infinite',
  stack5: 'Load-bearing wreath',
  perfect: 'Perfect day',
  sugar: 'Read the label',
  beach: 'Sand in everything',
  tools: 'Clicked around',
  rare: 'Pulled a rare',
  palette: 'Noticed the palette',
};
const ACH_TOTAL = Object.keys(ACH).length;
// How many of a kind, in one run, the item achievements take. One each made them all land in the first half minute.
const ACH_NEED = { hydrated: 5, card: 5, heart: 5, steak: 3, sugar: 2 };
const NUM_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
// How each one is earned, for the Achievements menu. Keep each under 27 characters; the column is narrow.
const ACH_HOW: Record<string, string> = {
  literal: 'a wreath on the head',
  hydrated: NUM_WORDS[ACH_NEED.hydrated] + ' S.Pellegrino in a run',
  card: NUM_WORDS[ACH_NEED.card] + ' Magic cards in a run',
  heart: NUM_WORDS[ACH_NEED.heart] + ' black hearts in a run',
  steak: NUM_WORDS[ACH_NEED.steak] + ' steaks in a run',
  two: 'two catches in ' + DOUBLE_WINDOW_MS + ' ms',
  infinite: 'storm count ' + STORM_X3,
  stack5: 'five wreaths on the head',
  perfect: PERFECT_DAY + ' XP in one run',
  sugar: 'let ' + NUM_WORDS[ACH_NEED.sugar] + ' sugars fall past',
  beach: 'die to the beach',
  tools: 'try ' + NUM_WORDS[TOOLS_TO_FIND] + ' of the tools',
  rare: 'catch a gold-bordered card',
  palette: 'click a palette color',
};
const STORE_ACH = 'wreathquest.achievements', STORE_BEST = 'wreathquest.best', STORE_TIME = 'wreathquest.besttime';
const DEBUG = location.hash === '#debug' || location.hash === '#bot';   // tuning modes never save records
const STORE_VERSION = 'wreathquest.v', SAVE_VERSION = '2';            // bump to wipe everyone's saved scores
function load(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function save(key: string, v: string): void { if (DEBUG) return; try { localStorage.setItem(key, v); } catch { /* fine */ } }
if (load(STORE_VERSION) !== SAVE_VERSION) {
  try { for (const k of [STORE_ACH, STORE_BEST, STORE_TIME]) localStorage.removeItem(k); localStorage.setItem(STORE_VERSION, SAVE_VERSION); } catch { /* fine */ }
}
const everAch = new Set<string>((load(STORE_ACH) ?? '').split(',').filter(id => id in ACH));
let bestXP = Number(load(STORE_BEST) ?? 0) || 0;
let bestTime = Number(load(STORE_TIME) ?? 0) || 0;

// ============================================================================
//  State
// ============================================================================
interface Item { kind: Kind; x: number; y: number; w: number; h: number; vy: number; wob: number; passedHead: boolean; vx?: number; bounced?: boolean; rare?: boolean; }
interface Floater { text: string; x: number; y: number; t: number; life: number; scale: number; }
interface Flyer { text: string; x0: number; y0: number; x1: number; y1: number; t: number; life: number; }   // XP on its way to the counter
interface Btn { id: string; x: number; y: number; w: number; h: number; label: string; }

const G = {
  phase: 'title' as Phase,
  t: 0, xp: 0, storm: 0, undos: START_UNDOS, stack: 0, level: 0,
  items: [] as Item[],
  spawnTimer: 0.8, spawnCount: 0, dodged: 0, caught: 0, wreathsOnHead: 0,
  catches: {} as Partial<Record<Kind, number>>, dodges: {} as Partial<Record<Kind, number>>,   // per kind, this run
  px: 0, targetX: 0,
  floaters: [] as Floater[],
  flyers: [] as Flyer[], xpFlash: 0, landFx: 0,
  toolPress: -1, toolPressUntil: 0,   // a toolbox button held down for a moment after a click
  banner: null as { text: string; t: number; life: number } | null,
  achQueue: [] as string[], achT: 0,
  borderFx: 0, infFx: 0, shakeFx: 0, dyingT: 0,   // infFx: the storm box blinks for a moment on going infinite
  lastCatchAt: -1e9, lastCatchXP: 0,
  cause: '' as Kind | 'border' | '',
  deathMsg: '',
  runAch: [] as string[],
  paused: false, finishTime: 0,
  status: '', statusT: 0,
  mouseX: 0, mouseY: 0, usingKeys: false,
  keys: { left: false, right: false },
  hover: null as string | null,
  bot: false, botSkill: 0.7,
};
let buttons: Btn[] = [];
let portrait!: HTMLCanvasElement;   // her portrait, cropped and scaled once
let titleArt!: HTMLCanvasElement;   // the whole drawing, for the title screen
let photo: HTMLImageElement | null = null;   // the photo; shown once every achievement has been earned
let achOpen = false;                         // the Achievements dialog is up
let restoreArmed = 0;                        // Restore needs a second click before this time (ms)
let chrome!: HTMLCanvasElement;     // the Paint window, drawn once
let menuRects: { label: string; x: number; w: number }[] = [];
let paletteRects: { x: number; y: number }[] = [];

const canvas = document.getElementById('paint') as HTMLCanvasElement;
canvas.width = WIN_W; canvas.height = WIN_H;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

// ============================================================================
//  Helpers
// ============================================================================
const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const pad4 = (n: number) => String(Math.floor(n)).padStart(4, '0');
function fmtTime(s: number): string { const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + String(r).padStart(2, '0'); }
function difficulty(): number { return Math.pow(clamp(G.t / RAMP_SECONDS, 0, 1), 1.4); }
/** Multiplier on the time between spawns: WARMUP_SPACING for the first WARMUP_HOLD seconds, easing to 1 by WARMUP_END. */
function warmup(): number {
  if (G.t <= WARMUP_HOLD) return WARMUP_SPACING;
  const k = clamp((G.t - WARMUP_HOLD) / (WARMUP_END - WARMUP_HOLD), 0, 1);
  return lerp(WARMUP_SPACING, 1, k * k * (3 - 2 * k));
}
function multiplier(): number { return G.storm >= STORM_X3 ? 3 : G.storm >= STORM_X2 ? 2 : 1; }
function portraitRect() { return { x: Math.round(G.px), y: PLAY_H - portrait.height - 6, w: portrait.width, h: portrait.height }; }
function maxPX(): number { return PLAY_W - portrait.width; }
function stackHeight(): number { return Math.min(G.stack, 14) * 12; }
function setStatus(s: string, secs = 3): void { G.status = s; G.statusT = secs; }
function banner(s: string, life = 1.5): void { G.banner = { text: s, t: 0, life: life + BANNER_LINGER }; }
function floater(s: string, x: number, y: number, scale = 2): void { G.floaters.push({ text: s, x, y, t: 0, life: 0.9, scale }); }
const XP_TARGET_X = 72, XP_TARGET_Y = 17;   // center of the XP digits in the HUD
function flyer(s: string, x: number, y: number): void { G.flyers.push({ text: s, x0: x, y0: y, x1: XP_TARGET_X, y1: XP_TARGET_Y, t: 0, life: 0.55 }); }
/** Restore, for real: every achievement gone, best XP and best time gone, the photo locked again. */
function resetProgress(): void {
  everAch.clear(); bestXP = 0; bestTime = 0; G.runAch = [];
  if (!DEBUG) { try { for (const k of [STORE_ACH, STORE_BEST, STORE_TIME]) localStorage.removeItem(k); } catch { /* fine */ } }
  SFX.undo();
  setStatus('Restored. There is nothing to show for it.', 5);
}
function unlock(id: string): void {
  if (G.runAch.includes(id)) return;
  G.runAch.push(id);
  G.achQueue.push(id);
  if (!everAch.has(id)) {
    everAch.add(id); save(STORE_ACH, [...everAch].join(','));
    if (everAch.size >= ACH_TOTAL) setStatus('Last one. Photo unlocked. See Achievements.', 10);
  }
}

// ============================================================================
//  Paint window chrome (drawn once into an offscreen canvas)
// ============================================================================
function bevel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, raised: boolean, thick = 2): void {
  const tl = raised ? WHITE : DARK, br = raised ? DARK : WHITE;
  const tl2 = raised ? LIGHT : BLACK, br2 = raised ? BLACK : LIGHT;
  g.fillStyle = tl; g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, h);
  g.fillStyle = br; g.fillRect(x, y + h - 1, w, 1); g.fillRect(x + w - 1, y, 1, h);
  if (thick > 1) {
    g.fillStyle = tl2; g.fillRect(x + 1, y + 1, w - 2, 1); g.fillRect(x + 1, y + 1, 1, h - 2);
    g.fillStyle = br2; g.fillRect(x + 1, y + h - 2, w - 2, 1); g.fillRect(x + w - 2, y + 1, 1, h - 2);
  }
}
/** Tiny pixel plotter for the toolbar icons: no anti-aliasing anywhere. */
class Pix {
  constructor(private g: CanvasRenderingContext2D, private ox: number, private oy: number) {}
  dot(x: number, y: number, c = BLACK) { this.g.fillStyle = c; this.g.fillRect(this.ox + x, this.oy + y, 1, 1); }
  line(x0: number, y0: number, x1: number, y1: number, c = BLACK) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) { this.dot(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  rect(x: number, y: number, w: number, h: number, c = BLACK) { this.line(x, y, x + w - 1, y, c); this.line(x, y + h - 1, x + w - 1, y + h - 1, c); this.line(x, y, x, y + h - 1, c); this.line(x + w - 1, y, x + w - 1, y + h - 1, c); }
  fill(x: number, y: number, w: number, h: number, c = BLACK) { this.g.fillStyle = c; this.g.fillRect(this.ox + x, this.oy + y, w, h); }
  dotted(x: number, y: number, w: number, h: number) { for (let i = 0; i < w; i += 2) { this.dot(x + i, y); this.dot(x + i, y + h - 1); } for (let i = 0; i < h; i += 2) { this.dot(x, y + i); this.dot(x + w - 1, y + i); } }
  ellipse(cx: number, cy: number, rx: number, ry: number, c = BLACK) {
    for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; this.dot(Math.round(cx + Math.cos(t) * rx), Math.round(cy + Math.sin(t) * ry), c); }
  }
}
function drawToolIcon(g: CanvasRenderingContext2D, i: number, x: number, y: number): void {
  const p = new Pix(g, x, y);
  switch (i) {
    case 0: p.line(2, 7, 6, 2); p.line(6, 2, 13, 4); p.line(13, 4, 11, 10); p.line(11, 10, 13, 14); p.line(13, 14, 4, 13); p.line(4, 13, 2, 7); break; // free-form select
    case 1: p.dotted(2, 2, 12, 12); break; // select
    case 2: p.fill(3, 8, 8, 5, WHITE); p.rect(3, 8, 8, 5); p.line(6, 4, 13, 4); p.line(13, 4, 13, 9); p.line(3, 8, 6, 4); p.line(11, 12, 13, 9); break; // eraser
    case 3: p.line(4, 7, 9, 3); p.line(9, 3, 13, 7); p.line(13, 7, 8, 12); p.line(8, 12, 4, 7); p.fill(6, 7, 5, 3, DARK); p.line(3, 8, 2, 12); p.dot(2, 13); break; // fill
    case 4: p.line(3, 13, 9, 7); p.line(4, 13, 10, 7); p.fill(9, 3, 4, 4, DARK); p.rect(9, 3, 4, 4); break; // pick color
    case 5: p.ellipse(7, 6, 4, 4); p.line(10, 9, 14, 13); p.line(11, 9, 14, 12); break; // magnifier
    case 6: p.line(3, 13, 11, 5); p.line(4, 13, 12, 6); p.line(11, 5, 12, 6); p.dot(2, 14); p.fill(11, 3, 3, 3, DARK); break; // pencil
    case 7: p.fill(5, 9, 6, 4, BLACK); p.line(7, 2, 7, 8); p.line(8, 2, 8, 8); p.fill(4, 12, 8, 2, DARK); break; // brush
    case 8: p.fill(3, 7, 5, 7, DARK); p.rect(3, 7, 5, 7); p.line(5, 4, 5, 6); for (const [a, b] of [[9, 3], [11, 5], [13, 3], [10, 8], [13, 7], [12, 10], [9, 11]]) p.dot(a, b); break; // airbrush
    case 9: p.line(4, 13, 8, 3); p.line(8, 3, 12, 13); p.line(6, 9, 10, 9); break; // text A
    case 10: p.line(2, 13, 13, 2); break; // line
    case 11: for (let k = 0; k < 12; k++) p.dot(2 + k, Math.round(8 + Math.sin(k / 11 * Math.PI * 2) * 4)); break; // curve
    case 12: p.rect(2, 4, 12, 8); break; // rectangle
    case 13: p.line(2, 10, 6, 3); p.line(6, 3, 13, 5); p.line(13, 5, 10, 13); p.line(10, 13, 2, 10); break; // polygon
    case 14: p.ellipse(8, 8, 6, 4); break; // ellipse
    case 15: p.line(4, 4, 11, 4); p.line(4, 12, 11, 12); p.line(2, 6, 2, 10); p.line(13, 6, 13, 10); p.dot(3, 5); p.dot(12, 5); p.dot(3, 11); p.dot(12, 11); break; // rounded rect
  }
}
function buildChrome(): void {
  chrome = document.createElement('canvas');
  chrome.width = WIN_W; chrome.height = WIN_H;
  const g = chrome.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = LIGHT; g.fillRect(0, 0, WIN_W, WIN_H);
  bevel(g, 0, 0, WIN_W, WIN_H, true);
  // title bar
  g.fillStyle = BLACK; g.fillRect(FRAME, FRAME, WIN_W - FRAME * 2, TITLE_H - 2);
  // the little paint icon
  const p = new Pix(g, FRAME + 4, FRAME + 3);
  p.fill(2, 4, 10, 9, LIGHT); p.rect(2, 4, 10, 9, WHITE); p.fill(4, 6, 3, 3, DARK); p.fill(8, 6, 3, 3, WHITE); p.fill(4, 10, 3, 2, WHITE); p.line(11, 1, 14, 4, WHITE); p.line(12, 1, 14, 3, WHITE);
  text(g, 'untitled - Paint', FRAME + 24, FRAME + 4, 2, WHITE);
  // title buttons
  const bx = WIN_W - FRAME - 2;
  for (let i = 0; i < 3; i++) {
    const x = bx - (3 - i) * 18 - (i === 2 ? 0 : 2), y = FRAME + 2, w = 16, h = TITLE_H - 6;
    g.fillStyle = LIGHT; g.fillRect(x, y, w, h); bevel(g, x, y, w, h, true);
    const q = new Pix(g, x, y);
    if (i === 0) q.fill(4, h - 5, 7, 2);
    if (i === 1) { q.rect(3, 3, 9, 8); q.fill(3, 3, 9, 2); }
    if (i === 2) { q.line(4, 3, 11, 10); q.line(5, 3, 12, 10); q.line(4, 10, 11, 3); q.line(5, 10, 12, 3); }
  }
  // menu bar
  const my = FRAME + TITLE_H;
  let mx = FRAME + 6;
  menuRects = [];
  for (const label of ['File', 'Edit', 'View', 'Image', 'Options', 'Help', 'Sound', 'Achievements']) {
    const w = textW(label === 'Sound' ? 'Sound: off' : label, 2) + 12;
    menuRects.push({ label, x: mx, w });
    if (label !== 'Sound') text(g, label, mx + 6, my + 4, 2, BLACK);   // Sound is drawn live, it changes
    g.fillStyle = BLACK; g.fillRect(mx + 6, my + 18, 2 * 5, 1); // underlined mnemonic
    mx += w;
  }
  // toolbar
  const tx = FRAME + 2, ty = my + MENU_H + 2;
  for (let i = 0; i < 16; i++) {
    const col = i % 2, row = Math.floor(i / 2);
    const x = tx + 2 + col * 26, y = ty + 2 + row * 26;
    const active = i === 1; // Select is in use. Obviously.
    const down = active || (i === G.toolPress && performance.now() < G.toolPressUntil);
    g.fillStyle = active ? WHITE : LIGHT; g.fillRect(x, y, 25, 25);
    bevel(g, x, y, 25, 25, !down, 1);
    if (active) { g.fillStyle = LIGHT; for (let yy = y + 1; yy < y + 24; yy++) for (let xx = x + 1 + (yy & 1); xx < x + 24; xx += 2) g.fillRect(xx, yy, 1, 1); }
    drawToolIcon(g, i, x + 4 + (down ? 1 : 0), y + 4 + (down ? 1 : 0));
  }
  // tool options box: opaque / transparent selection
  const oy = ty + 2 + 8 * 26 + 6;
  g.fillStyle = LIGHT; g.fillRect(tx + 2, oy, 52, 50); bevel(g, tx + 2, oy, 52, 50, false, 1);
  const o = new Pix(g, tx + 2, oy);
  o.fill(6, 4, 40, 20, WHITE); o.dotted(8, 6, 36, 16); o.fill(14, 10, 24, 8, DARK); o.fill(12, 8, 10, 10, BLACK);
  o.dotted(8, 30, 36, 16); o.fill(14, 34, 24, 8, DARK); o.rect(12, 32, 10, 10, BLACK);
  // workspace around the image + the image's resize handles
  g.fillStyle = DARK; g.fillRect(PLAY_X - PAD, PLAY_Y - PAD, PLAY_W + PAD * 2, PLAY_H + PAD * 2);
  g.fillStyle = LIGHT; g.fillRect(PLAY_X - PAD + 1, PLAY_Y - PAD + 1, PLAY_W + PAD * 2 - 2, PLAY_H + PAD * 2 - 2);
  g.fillStyle = BLACK;
  g.fillRect(PLAY_X + PLAY_W + 1, PLAY_Y + PLAY_H / 2 - 2, 4, 4);
  g.fillRect(PLAY_X + PLAY_W / 2 - 2, PLAY_Y + PLAY_H + 1, 4, 4);
  g.fillRect(PLAY_X + PLAY_W + 1, PLAY_Y + PLAY_H + 1, 4, 4);
  // palette: the color box and 28 swatches. They are all gray.
  const py = PALETTE_Y + 4;
  g.fillStyle = LIGHT; g.fillRect(FRAME + 4, py, 34, 34); bevel(g, FRAME + 4, py, 34, 34, false, 1);
  g.fillStyle = WHITE; g.fillRect(FRAME + 16, py + 12, 16, 16); bevel(g, FRAME + 16, py + 12, 16, 16, true, 1);
  g.fillStyle = BLACK; g.fillRect(FRAME + 9, py + 5, 16, 16); bevel(g, FRAME + 9, py + 5, 16, 16, true, 1);
  const grays = ['#000000', '#404040', '#606060', '#808080', '#a0a0a0', '#c0c0c0', '#e0e0e0', '#ffffff', '#101010', '#202020', '#303030', '#505050', '#707070', '#909090',
                 '#ffffff', '#f0f0f0', '#d0d0d0', '#b0b0b0', 'dither1', '#787878', 'dither2', '#282828', '#b8b8b8', '#989898', '#585858', '#383838', '#181818', 'dither3'];
  paletteRects = [];
  for (let i = 0; i < 28; i++) {
    const col = i % 14, row = Math.floor(i / 14);
    const x = FRAME + 46 + col * 18, y = py + 1 + row * 17;
    paletteRects.push({ x, y });
    const c = grays[i];
    if (c.startsWith('dither')) {
      const [a, b] = c === 'dither1' ? [BLACK, WHITE] : c === 'dither2' ? [DARK, WHITE] : [BLACK, DARK];
      for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) { g.fillStyle = ((xx + yy) & 1) ? a : b; g.fillRect(x + xx, y + yy, 1, 1); }
    } else { g.fillStyle = c; g.fillRect(x, y, 16, 16); }
    bevel(g, x, y, 16, 16, false, 1);
  }
  // status bar panes (the text is drawn live)
  const sy = STATUS_Y + 2;
  bevel(g, FRAME + 2, sy, WIN_W - 306 - FRAME, STATUS_H - 4, false, 1);
  bevel(g, WIN_W - 302, sy, 176, STATUS_H - 4, false, 1);
  bevel(g, WIN_W - 124, sy, 120 - FRAME, STATUS_H - 4, false, 1);
}

// ============================================================================
//  Her drawing: resampled once, carefully, then always drawn 1:1
// ============================================================================
function resample(img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dw: number, dh: number): HTMLCanvasElement {
  // Two-step downscale with smoothing on, so her 1-2px lines survive the shrink.
  let cur: HTMLCanvasElement | HTMLImageElement = img;
  let cx = sx, cy = sy, cw = sw, ch = sh;
  while (cw / dw > 1.9) {
    const nw = Math.round(cw / 1.8), nh = Math.round(ch / 1.8);
    const c = document.createElement('canvas'); c.width = nw; c.height = nh;
    const g = c.getContext('2d')!; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(cur, cx, cy, cw, ch, 0, 0, nw, nh);
    cur = c; cx = 0; cy = 0; cw = nw; ch = nh;
  }
  const out = document.createElement('canvas'); out.width = dw; out.height = dh;
  const g = out.getContext('2d')!; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(cur, cx, cy, cw, ch, 0, 0, dw, dh);
  return out;
}

// ============================================================================
//  Sound: everything is synthesised, nothing is loaded. PC-speaker manners.
//  The in-game loop is Leontovych's four-note bell figure (1914, public domain),
//  arranged for square waves and sped up as the run gets worse.
// ============================================================================
const SOUND_DEFAULT = true;                 // set false to start muted
const STORE_SOUND = 'wreathquest.sound';
let soundOn = (load(STORE_SOUND) ?? (SOUND_DEFAULT ? '1' : '0')) === '1';
let ac: AudioContext | null = null;
let masterGain!: GainNode, musicGain!: GainNode, sfxGain!: GainNode, noiseBuf!: AudioBuffer;
let notesScheduled = 0;
function ensureAudio(): void {
  if (!ac) {
    try { ac = new AudioContext(); } catch { return; }
    masterGain = ac.createGain(); masterGain.gain.value = soundOn ? 1 : 0; masterGain.connect(ac.destination);
    musicGain = ac.createGain(); musicGain.gain.value = MUSIC_LEVEL; musicGain.connect(masterGain);
    sfxGain = ac.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(masterGain);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') void ac.resume();
}
function setSound(on: boolean): void {
  soundOn = on; save(STORE_SOUND, on ? '1' : '0');
  if (ac) masterGain.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, 0.02);
  setStatus('Sound: ' + (on ? 'on' : 'off') + '.  (M)', 3);
}
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
function voice(type: OscillatorType, f0: number, at: number, dur: number, vol: number, dest: GainNode, f1?: number): void {
  if (!ac) return;
  const o = ac.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, at);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(dest); o.start(at); o.stop(at + dur + 0.03);
  notesScheduled++;
}
function hiss(at: number, dur: number, vol: number, dest: GainNode, hz = 6000): void {
  if (!ac) return;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hz; f.Q.value = 0.8;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(at); s.stop(at + dur + 0.02);
}
function sfx(type: OscillatorType, f0: number, dur: number, vol = 0.2, delay = 0, f1?: number): void {
  if (ac) voice(type, f0, ac.currentTime + delay, dur, vol, sfxGain, f1);
}
const SFX = {
  click: () => sfx('square', 1200, 0.03, 0.08),
  blip: (storm: number) => sfx('square', 660 * Math.pow(2, Math.min(storm, 24) / 24), 0.07, 0.16),   // rises an octave over 24 storm
  double: () => { sfx('square', 988, 0.06, 0.16); sfx('square', 1480, 0.1, 0.16, 0.06); },
  wreath: () => { sfx('square', 880, 0.08, 0.16); sfx('square', 1320, 0.14, 0.16, 0.08); },
  bounce: () => { sfx('square', 520, 0.05, 0.14); sfx('square', 390, 0.09, 0.14, 0.05); },
  rare: () => { sfx('triangle', 1318, 0.07, 0.16); sfx('triangle', 1760, 0.12, 0.16, 0.07); sfx('triangle', 2637, 0.16, 0.12, 0.14); },
  bad: () => { sfx('sawtooth', 120, 0.28, 0.25, 0, 60); if (ac) hiss(ac.currentTime, 0.14, 0.18, sfxGain, 1800); },
  border: () => sfx('sawtooth', 330, 0.45, 0.2, 0, 90),
  ach: () => { sfx('triangle', 880, 0.12, 0.2); sfx('triangle', 1108, 0.12, 0.2, 0.08); sfx('triangle', 1318, 0.22, 0.2, 0.16); },
  ding: () => { sfx('sine', 1760, 0.6, 0.18); sfx('sine', 3520, 0.3, 0.06); },
  undo: () => { sfx('square', 220, 0.1, 0.14); sfx('square', 185, 0.16, 0.14, 0.1); },
  death: () => { sfx('sawtooth', 440, 0.5, 0.2, 0, 415); sfx('sawtooth', 392, 0.5, 0.2, 0.5, 370); sfx('sawtooth', 349, 0.9, 0.2, 1.0, 311); },
  win: () => { [523, 659, 784].forEach((f, i) => sfx('square', f, 0.14, 0.16, i * 0.13)); sfx('square', 1047, 0.7, 0.16, 0.39); sfx('triangle', 523, 0.7, 0.14, 0.39); },
};
// --- the loop: 3/4 time, six eighth notes a bar, sixteen bars to a pass. Four passes, each a little different,
//     then the whole thing goes up a minor third and comes round again. MIDI numbers, 0 is a rest.
const BAR_LEN = 6, BARS = 16, PASSES = 4;
// chord roots per bar, one row per pass (A2 = 45)
const PROG: number[][] = [
  [45, 45, 45, 45, 45, 45, 45, 45, 41, 43, 41, 40, 45, 45, 45, 45],   // A: the bells as written: Am, then F G F E
  [45, 45, 48, 48, 41, 41, 43, 43, 45, 45, 48, 48, 41, 41, 40, 40],   // B: Am C F G, twice, leaning on E to come home
  [45, 45, 41, 41, 38, 38, 40, 40, 45, 45, 41, 41, 38, 38, 40, 40],   // C: Am F Dm E, the bells an octave up
  [45, 45, 45, 45, 43, 43, 41, 41, 45, 45, 45, 45, 41, 43, 41, 40],   // D: home again, G F under the bells, the written ending
];
// the four-note bell figure, voiced for each chord it sits on (keyed by root pitch class)
const OST: Record<number, number[]> = {
  9: [76, 0, 74, 76, 72, 0],   // Am: E D E C
  0: [79, 0, 77, 79, 76, 0],   // C:  G F G E
  5: [77, 0, 76, 77, 72, 0],   // F:  F E F C
  7: [79, 0, 77, 79, 74, 0],   // G:  G F G D
  2: [77, 0, 76, 77, 74, 0],   // Dm: F E F D
  4: [76, 0, 74, 76, 71, 0],   // E:  E D E B
};
const ANSWER = [[88, 0, 88, 0, 86, 0], [88, 0, 86, 0, 84, 0], [86, 0, 84, 0, 83, 0], [84, 0, 0, 0, 83, 81]];   // a line that answers the bells, four bars
const RUN: Record<number, number[]> = { 8: [81, 79, 77, 76, 74, 72], 9: [71, 72, 74, 76, 77, 79], 10: [81, 79, 77, 76, 74, 72], 11: [71, 0, 69, 0, 0, 0] };
const SCALE = [0, 2, 3, 5, 7, 8, 10];      // A natural minor, semitones above A
const MINOR = new Set([9, 2]);            // Am and Dm are minor; the others, E included, are major
/** A note moved by whole scale steps inside A minor. A note off the scale just moves a minor third. */
function diatonic(n: number, steps: number): number {
  const rel = ((n - 9) % 12 + 12) % 12, i = SCALE.indexOf(rel);
  if (i < 0) return n + 3 * Math.sign(steps);
  const j = i + steps, oct = Math.floor(j / 7);
  return n - rel + SCALE[((j % 7) + 7) % 7] + oct * 12;
}
const BASS = 0.4;                          // the bass sits well under the bells
const music = { mode: 'none' as 'none' | 'title' | 'game', step: 0, next: 0 };
function scheduleStep(step: number, at: number, e: number, game: boolean): void {
  const passLen = BAR_LEN * BARS;
  const pass = Math.floor(step / passLen) % PASSES, bar = Math.floor(step / BAR_LEN) % BARS, pos = step % BAR_LEN;
  const shift = (Math.floor(step / (passLen * PASSES)) % 2) * 3;   // after four passes, up a minor third; after four more, back
  const d = game ? difficulty() : 0;
  const busy = game && (d > 0.3 || G.storm >= 10);
  const root = PROG[pass][bar], ost = OST[root % 12] ?? OST[9];
  const lead: OscillatorType = game ? 'square' : 'triangle';
  const N = (n: number) => midi(n + shift);
  // the bells; in pass C they go up an octave and play short
  const up = pass === 2 ? 12 : 0, len = pass === 2 ? 0.55 : 0.9;
  if (ost[pos]) voice(lead, N(ost[pos] + up), at, e * len, (game ? 0.07 : 0.09) + d * 0.02, musicGain);
  // the written run, in passes A and D
  const run = pass === 0 || pass === 3 ? RUN[bar] : undefined;
  if (run && run[pos]) voice(lead, N(run[pos] + (game ? 12 : 0)), at, e * 0.9, 0.06, musicGain);
  // the answering line, passes B and D, in the second half of each eight bars
  if ((pass === 1 || pass === 3) && bar % 8 >= 4) { const n = ANSWER[bar % 4][pos]; if (n) voice('triangle', N(n), at, e * 1.1, game ? 0.07 : 0.05, musicGain); }
  // a third above the bells when things are busy; in pass C, a third below the raised bells instead
  if (ost[pos] && (pass === 2 || (busy && ((bar >= 4 && bar < 8) || bar >= 12)))) voice('square', N(diatonic(ost[pos], pass === 2 ? -2 : 2)), at, e * 0.8, 0.045, musicGain);
  // bass: each pass walks differently
  const third = root + (MINOR.has(root % 12) ? 3 : 4);
  if (pass === 1) {
    if (pos === 0) voice('triangle', N(root), at, e * 1.6, 0.16 * BASS, musicGain);
    if (pos === 2) voice('triangle', N(root + 7), at, e * 1.2, 0.11 * BASS, musicGain);
    if (pos === 4) voice('triangle', N(root + 12), at, e * 1.2, 0.1 * BASS, musicGain);
  } else if (pass === 2) {
    if (pos === 0) voice('triangle', N(root), at, e * 1.8, 0.16 * BASS, musicGain);
    if (pos === 3) voice('triangle', N(third), at, e * 1.2, 0.11 * BASS, musicGain);
    if (pos === 5 && bar % 2 === 1) voice('triangle', N(root + 7), at, e * 0.8, 0.09 * BASS, musicGain);   // a pickup into the next bar
  } else {
    if (pos === 0) voice('triangle', N(root), at, e * 1.8, 0.16 * BASS, musicGain);
    if (pos === 4) voice('triangle', N(root + 7), at, e * 1.4, 0.12 * BASS, musicGain);
  }
  if (game) {
    hiss(at, 0.025, pos % 2 === 0 ? 0.05 : 0.02, musicGain, 8000);                                   // closed hat
    if (pass >= 1 && pos === 5) hiss(at, 0.07, 0.035, musicGain, 9000);                             // an open hat on the and of three
    if (pos === 0 || (d > 0.5 && pos === 3) || (pass === 2 && pos === 4)) voice('square', 80, at, 0.09, 0.15, musicGain, 40);   // kick
    if ((pass >= 2 || d > 0.6) && pos === 3) hiss(at, 0.08, 0.12, musicGain, 1800);                 // snare on two
    if (bar === BARS - 1 && pos >= 2) hiss(at, 0.06, 0.06 + (pos - 2) * 0.03, musicGain, 1800);      // a fill into the next pass
  }
}
function musicTick(): void {
  if (!ac) return;
  const want: typeof music.mode = G.phase === 'playing' ? (G.paused ? 'none' : 'game') : G.phase === 'dying' ? 'none' : 'title';
  if (want !== music.mode) {
    music.mode = want; music.step = 0;
    music.next = ac.currentTime + (want === 'title' && G.phase !== 'title' && G.phase !== 'howto' ? 1.4 : 0.05);  // let the sting or fanfare finish
  }
  if (music.mode === 'none') return;
  if (!soundOn) { music.next = Math.max(music.next, ac.currentTime); return; }
  const game = music.mode === 'game';
  while (music.next < ac.currentTime + 0.25) {
    const bpm = game ? lerp(150, 200, difficulty()) : 82;
    const e = 30 / bpm;
    scheduleStep(music.step, music.next, e, game);
    music.next += e; music.step++;
  }
}
let lastAchSound = '';

// ============================================================================
//  Run control
// ============================================================================
function startRun(): void {
  SFX.click();
  lastAchSound = '';
  G.phase = 'playing';
  G.t = 0; G.xp = 0; G.storm = 0; G.undos = START_UNDOS; G.stack = 0; G.level = 0;
  G.items = []; G.spawnTimer = 0.7; G.spawnCount = 0; G.dodged = 0; G.caught = 0; G.wreathsOnHead = 0; G.catches = {}; G.dodges = {};
  G.floaters = []; G.flyers = []; G.xpFlash = 0; G.landFx = 0; G.banner = null; G.achQueue = []; G.achT = 0;
  G.borderFx = 0; G.infFx = 0; G.shakeFx = 0; G.dyingT = 0;
  G.lastCatchAt = -1e9; G.lastCatchXP = 0; G.cause = ''; G.deathMsg = '';
  G.runAch = []; G.paused = false; G.finishTime = 0;
  G.px = (PLAY_W - portrait.width) / 2; G.targetX = G.px;
  setStatus('Wreaths go on the head.', 4);
}
function endRun(): void {
  if (G.xp > bestXP) { bestXP = G.xp; save(STORE_BEST, String(bestXP)); }
}
function die(): void {
  G.phase = 'dying'; G.dyingT = 1.1;
  SFX.death();
  G.deathMsg = G.cause === 'border' ? BORDER_DEATH : G.cause ? (KINDS[G.cause].death ?? '') : 'You have died.';
  if (G.cause === 'beach') unlock('beach');
  endRun();
}
function win(): void {
  G.phase = 'won'; G.finishTime = G.t;
  SFX.win();
  unlock('perfect');
  if (!bestTime || G.t < bestTime) { bestTime = G.t; save(STORE_TIME, String(Math.round(G.t))); }
  endRun();
}

function award(base: number, x: number, y: number, label: string): void {
  const now = G.t;
  const mult = multiplier();
  let gain = base * mult;
  let tag = label + ' +' + gain + (mult > 1 ? ' ×' + mult : '');
  if (now - G.lastCatchAt < DOUBLE_WINDOW_MS / 1000) {
    // two things at once: this one is doubled, and so, retroactively, is the previous one
    gain = gain * 2 + G.lastCatchXP;
    tag = 'TWO THINGS AT ONCE ×2 +' + gain;
    SFX.double();
    unlock('two');
    G.lastCatchAt = -1e9;
  } else { G.lastCatchAt = now; G.lastCatchXP = gain; }
  gainXP(gain, tag, x, y);
}
/** Adds XP with the usual fanfare: floater, flyer into the counter, level ding, and the perfect-day check. */
function gainXP(gain: number, tag: string, x: number, y: number): void {
  const before = G.xp;
  G.xp = Math.min(PERFECT_DAY, G.xp + gain);
  floater(tag, x, y);
  flyer('+' + gain, x, y);
  const lvl = Math.floor(G.xp / XP_PER_LEVEL);
  if (lvl > G.level && G.xp < PERFECT_DAY) {
    G.level = lvl;
    const r = portraitRect();
    floater('Ding. Level ' + lvl + '.', r.x + r.w * HEAD_CX, r.y - stackHeight() - 40, 2);
    SFX.ding();
    setStatus('You have gained a level. Welcome to level ' + lvl + '.', 3);
  }
  if (G.xp >= PERFECT_DAY && before < PERFECT_DAY) { G.level = 10; win(); }
}
function bumpStorm(): void {
  G.storm++;
  if (G.storm === STORM_X3) { unlock('infinite'); G.infFx = 1.2; banner('Storm count ' + G.storm + '. Infinite.', 1.6); }
  else if (G.storm > 0 && G.storm % 10 === 0) floater('STORM ' + G.storm, PLAY_W - 90, 70, 2);
}
function catchGood(it: Item): void {
  G.caught++;
  bumpStorm();
  SFX.blip(G.storm);
  if (it.rare) SFX.rare();
  award(KINDS[it.kind].xp * (it.rare ? RARE_CARD_MULT : 1), it.x + it.w / 2, it.y, it.rare ? 'RARE' : KINDS[it.kind].label);
  if (it.rare) unlock('rare');
  const n = (G.catches[it.kind] = (G.catches[it.kind] ?? 0) + 1);
  if (it.kind === 'pellegrino' && n >= ACH_NEED.hydrated) unlock('hydrated');
  if (it.kind === 'card' && n >= ACH_NEED.card) unlock('card');
  if (it.kind === 'heart' && n >= ACH_NEED.heart) unlock('heart');
  if (it.kind === 'steak' && n >= ACH_NEED.steak) unlock('steak');
}
function landOnHead(): void {
  G.stack++; G.wreathsOnHead++; G.caught++;
  G.landFx = LAND_FX;
  bumpStorm();
  SFX.wreath();
  const r = portraitRect();
  award(XP_WREATH, r.x + r.w * HEAD_CX, r.y - stackHeight() - 10, 'ON HEAD');
  unlock('literal');
  if (G.stack === 5) { unlock('stack5'); gainXP(STACK_BONUS, 'LOAD-BEARING +' + STACK_BONUS, r.x + r.w * HEAD_CX, r.y - stackHeight() - 34); }
}
/** Where a point sits across the head zone: -1 at its left edge, 0 under the center of the stack, 1 at its right edge. */
function stackOffset(cx: number, P: { x: number; w: number }): number {
  const headL = P.x + HEAD_L * P.w, headR = P.x + HEAD_R * P.w;
  return (cx - (headL + headR) / 2) / ((headR - headL) / 2);
}
function bounceOff(it: Item, dir: number): void {
  // Near the stack but not on it: the wreath hops away and falls clear. No border, no undo.
  it.bounced = true; it.passedHead = true;
  it.vx = dir * 260; it.vy = -Math.max(120, it.vy * 0.5);
  SFX.bounce();   // no words for a miss; the hop says it
}
function loseUndo(cause: Kind | 'border', msg: string): void {
  G.undos--; G.storm = 0; G.cause = cause; G.shakeFx = 0.35;
  if (cause !== 'border') SFX.bad();
  banner(msg, 1.6);
  setStatus(G.undos > 0 ? 'Undo used. ' + G.undos + ' left.' : 'No undos left.', 3);
  if (G.undos <= 0) die();
}
function catchBad(it: Item): void { loseUndo(it.kind, pick(KINDS[it.kind].bad!)); }
function borderFail(): void {
  G.borderFx = 1;
  SFX.border();
  loseUndo('border', pick(BORDER_MSGS));
}

// ============================================================================
//  Spawning
// ============================================================================
function spawnOne(x: number | null, kind?: Kind): Item {
  const d = difficulty();
  if (!kind) {
    if (G.spawnCount === 0) kind = 'wreath';
    else if (G.spawnCount === 1) kind = 'pellegrino';
    else if (Math.random() < lerp(BAD_START, BAD_END, d)) kind = pick(BAD_KINDS);
    else if (Math.random() < WREATH_SHARE) kind = 'wreath';
    else kind = Math.random() < 0.14 ? 'steak' : pick(['pellegrino', 'card', 'heart'] as Kind[]);
  }
  const rare = kind === 'card' && Math.random() < RARE_CARD_SHARE;
  const s = rare ? rareCard : SPRITES[kind];
  const w = s.width, h = s.height;
  if (x === null) x = 16 + Math.random() * (PLAY_W - 32 - w);
  const it: Item = { kind, x: clamp(x, 8, PLAY_W - 8 - w), y: -h - 4, w, h, vy: lerp(FALL_START, FALL_END, d) * (0.85 + Math.random() * 0.3), wob: Math.random() * 7, passedHead: false, rare };
  if (G.spawnCount === 0) { const r = portraitRect(); it.x = r.x + r.w * HEAD_CX - w / 2; it.vy = FALL_START; }
  G.items.push(it);
  G.spawnCount++;
  return it;
}
function spawn(): void {
  const d = difficulty();
  const first = spawnOne(null);
  if (G.spawnCount > 2 && Math.random() < lerp(PAIR_START, PAIR_END, d)) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const second = spawnOne(first.x + side * (110 + Math.random() * 60));
    second.y -= Math.random() * 30;
    second.vy = first.vy;
  }
}

// ============================================================================
//  Update
// ============================================================================
function update(dt: number): void {
  // timers that run in every phase
  if (G.statusT > 0) G.statusT -= dt;
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.life) G.banner = null; }
  for (const f of G.floaters) f.t += dt;
  G.floaters = G.floaters.filter(f => f.t < f.life);
  for (const f of G.flyers) f.t += dt;
  if (G.flyers.some(f => f.t >= f.life)) G.xpFlash = 0.14;   // the XP counter blinks as the points arrive
  G.flyers = G.flyers.filter(f => f.t < f.life);
  if (G.xpFlash > 0) G.xpFlash = Math.max(0, G.xpFlash - dt);
  if (G.landFx > 0) G.landFx = Math.max(0, G.landFx - dt);
  if (G.achQueue.length) { G.achT += dt; if (G.achT > 2.6 + BANNER_LINGER) { G.achQueue.shift(); G.achT = 0; } }
  if (G.achQueue.length && G.achQueue[0] !== lastAchSound) { lastAchSound = G.achQueue[0]; SFX.ach(); }
  if (G.borderFx > 0) G.borderFx = Math.max(0, G.borderFx - dt / 0.9);
  if (G.infFx > 0) G.infFx = Math.max(0, G.infFx - dt);
  if (G.shakeFx > 0) G.shakeFx = Math.max(0, G.shakeFx - dt);

  if (G.phase === 'dying') { G.dyingT -= dt; if (G.dyingT <= 0) G.phase = 'over'; return; }
  if (G.phase !== 'playing' || G.paused) return;

  G.t += dt;
  // movement
  if (G.bot) botThink();
  if (G.keys.left !== G.keys.right) {
    G.usingKeys = true;
    G.px = clamp(G.px + (G.keys.right ? 1 : -1) * KEY_SPEED * dt, 0, maxPX());
    G.targetX = G.px;
  } else if (!G.usingKeys) {
    const want = clamp(G.targetX, 0, maxPX());
    const step = MOUSE_SPEED * dt;
    G.px = clamp(G.px + clamp(want - G.px, -step, step), 0, maxPX());
  }
  // spawning
  G.spawnTimer -= dt;
  if (G.spawnTimer <= 0) { spawn(); G.spawnTimer = lerp(SPAWN_START, SPAWN_END, difficulty()) * warmup() * (0.8 + Math.random() * 0.4); }
  // items
  const P = portraitRect();
  const headLine = P.y - stackHeight();
  const keep: Item[] = [];
  for (const it of G.items) {
    it.y += it.vy * dt;
    it.wob += dt;
    if (it.bounced) { it.x += (it.vx ?? 0) * dt; it.vy += 900 * dt; }   // a bounced wreath arcs away under gravity
    const cx = it.x + it.w / 2, bottom = it.y + it.h;
    let done = false;
    if (it.kind === 'wreath') {
      if (!it.passedHead && bottom >= headLine) {
        const off = stackOffset(cx, P);   // -1..1 across the head zone, 0 is the center of the stack
        if (bottom <= headLine + 42 && Math.abs(off) <= PERFECT_ZONE) { landOnHead(); done = true; }
        else if (bottom <= headLine + 42 && Math.abs(off) <= 1 + EDGE_SLOP) bounceOff(it, off < 0 ? -1 : 1);
        else if (bottom > headLine + 42) it.passedHead = true;
      }
      if (!done && !it.bounced && bottom >= P.y + SHOULDER * P.h && cx >= P.x + 10 && cx <= P.x + P.w - 10 && it.y < P.y + P.h) { borderFail(); done = true; }
    } else if (!it.passedHead && bottom >= P.y) {
      // Things land on the portrait, or they don't. Once past the top band they are simply falling beside it.
      const ix = it.x + 5, iw = it.w - 10;
      const good = KINDS[it.kind].good;
      const inset = good ? 0 : BAD_INSET;   // good things are caught generously; bad things must hit the body
      if (bottom <= P.y + CATCH_BAND && ix < P.x + P.w - inset && ix + iw > P.x + inset) {
        if (good) catchGood(it); else catchBad(it);
        done = true;
      } else if (bottom > P.y + CATCH_BAND) it.passedHead = true;
    }
    if (G.phase !== 'playing') { if (!done) keep.push(it); continue; }  // a win or death froze the field
    if (done) continue;
    if (it.y > PLAY_H + 4) {
      if (!KINDS[it.kind].good) {
        G.dodged++;
        const n = (G.dodges[it.kind] = (G.dodges[it.kind] ?? 0) + 1);
        if (it.kind === 'sugar' && n >= ACH_NEED.sugar) unlock('sugar');
      }
      continue;
    }
    keep.push(it);
  }
  G.items = keep;
}

/** A crude auto-player, only for tuning. Enabled with #bot in the URL; skill 0..1. */
function botThink(): void {
  const P = portraitRect();
  const skill = G.botSkill;
  const horizon = 0.5 + skill * 0.9;   // weaker players look less far ahead
  let bestX = G.px, bestCost = Infinity;
  const margin = 6 + skill * 14;        // better players keep a little distance from bad things
  for (let x = 0; x <= maxPX(); x += 8) {
    let cost = Math.abs(x - G.px) * 0.004;
    for (const it of G.items) {
      const eta = (P.y - (it.y + it.h)) / it.vy;
      if (eta > horizon) continue;                                                    // not worth thinking about yet
      if (it.kind === 'wreath' ? it.y > P.y + P.h : it.y + it.h > P.y + CATCH_BAND) continue;   // gone past
      const soon = 1 / (0.2 + Math.max(0, eta));
      const cx = it.x + it.w / 2;
      if (it.kind === 'wreath') {
        if (eta >= 0 && cx >= x + HEAD_L * P.w && cx <= x + HEAD_R * P.w) cost -= 3 * soon;
        else if (cx > x + 10 - margin && cx < x + P.w - 10 + margin) cost += 12 * soon;
      } else if (KINDS[it.kind].good) {
        if (it.x + it.w - 5 > x && it.x + 5 < x + P.w) cost -= soon;
      } else if (it.x + it.w - 5 > x + BAD_INSET - margin && it.x + 5 < x + P.w - BAD_INSET + margin) cost += 12 * soon;
    }
    if (cost < bestCost) { bestCost = cost; bestX = x; }
  }
  G.usingKeys = false;
  G.targetX = clamp(bestX + (Math.random() - 0.5) * (8 + (1 - skill) * 100), 0, maxPX());
}

// ============================================================================
//  Rendering
// ============================================================================
function marquee(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, phase: number): void {
  g.fillStyle = WHITE; g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
  g.fillStyle = BLACK;
  const seg = 4, per = w * 2 + h * 2;
  for (let s = (phase % (seg * 2)); s < per; s += seg * 2) {
    for (let k = 0; k < seg; k++) {
      const d = s + k; if (d >= per) break;
      let px: number, py: number;
      if (d < w) { px = x + d; py = y; }
      else if (d < w + h) { px = x + w - 1; py = y + d - w; }
      else if (d < w * 2 + h) { px = x + w - 1 - (d - w - h); py = y + h - 1; }
      else { px = x; py = y + h - 1 - (d - w * 2 - h); }
      g.fillRect(px, py, 1, 1);
    }
  }
}
function dialogBox(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.fillStyle = WHITE; g.fillRect(x, y, w, h);
  g.fillStyle = BLACK; g.fillRect(x, y, w, 3); g.fillRect(x, y + h - 3, w, 3); g.fillRect(x, y, 3, h); g.fillRect(x + w - 3, y, 3, h);
  g.fillRect(x + 6, y + 6, w - 12, 1); g.fillRect(x + 6, y + h - 7, w - 12, 1); g.fillRect(x + 6, y + 6, 1, h - 12); g.fillRect(x + w - 7, y + 6, 1, h - 12);
}
function button(g: CanvasRenderingContext2D, id: string, label: string, x: number, y: number, w: number, h: number): void {
  buttons.push({ id, label, x, y, w, h });
  const hot = G.hover === id;
  g.fillStyle = hot ? BLACK : WHITE; g.fillRect(x, y, w, h);
  g.fillStyle = BLACK; g.fillRect(x, y, w, 2); g.fillRect(x, y + h - 2, w, 2); g.fillRect(x, y, 2, h); g.fillRect(x + w - 2, y, 2, h);
  text(g, label, x + w / 2, y + (h - 14) / 2, 2, hot ? WHITE : BLACK, 'center');
}
function hollowRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number): void {
  g.fillRect(x, y, w, t); g.fillRect(x, y + h - t, w, t); g.fillRect(x, y, t, h); g.fillRect(x + w - t, y, t, h);
}
function sparkle(g: CanvasRenderingContext2D, x: number, y: number, t: number, sx = 1, sy = 1, glints = 2, lit = 0.28): void {
  // Glints hop from berry to berry on a wreath drawn at (x, y); each is lit for the `lit` share of its cycle.
  const cx = 9, cy = 9, rad = 5.9, half = Math.floor(SPR / 2);   // ring geometry must match wreathRows()
  for (let k = 0; k < glints; k++) {
    const ph = t * 0.9 + k / glints, cyc = ph % 1;
    if (cyc > lit) continue;
    const slot = (Math.floor(ph) * 2 + k * 2) % 6;
    const a = (slot + 0.5) * Math.PI / 3;
    const px = Math.round(x + (cx + Math.cos(a) * rad) * SPR * sx), py = Math.round(y + (cy + Math.sin(a) * rad) * SPR * sy);
    const arm = cyc < 0.12 ? 2 : 1;
    g.fillStyle = LIGHT;
    g.fillRect(px - half - arm * SPR, py - half, (2 * arm + 1) * SPR, SPR);
    g.fillRect(px - half, py - half - arm * SPR, SPR, (2 * arm + 1) * SPR);
    g.fillStyle = WHITE; g.fillRect(px - half, py - half, SPR, SPR);
  }
}
function drawItem(g: CanvasRenderingContext2D, it: Item): void {
  const bad = !KINDS[it.kind].good;
  const dx = bad ? Math.round(Math.sin(it.wob * 28) * 3) : 0;
  const x = Math.round(it.x + dx), y = Math.round(it.y);
  g.drawImage(it.rare ? rareCard : SPRITES[it.kind], x, y);
  if (it.kind === 'wreath') sparkle(g, x, y, it.wob, 1, 1, 3, 0.4);   // falling wreaths sparkle a little more than the stack
}
function drawPortrait(g: CanvasRenderingContext2D, tNow: number): void {
  const P = portraitRect();
  const sx = G.shakeFx > 0 ? Math.round((Math.random() - 0.5) * 6) : 0;
  const x = P.x + sx, y = P.y;
  g.drawImage(portrait, x, y);
  // wreaths that landed, stacked, squashed into perspective
  const n = Math.min(G.stack, 14), ww = Math.round(P.w * 0.56), wh = 34;
  const wx = Math.round(x + P.w * HEAD_CX - ww / 2);
  for (let i = 0; i < n; i++) g.drawImage(SPRITES.wreath, wx, y - 16 - i * 12, ww, wh);
  if (n > 0) sparkle(g, wx, y - 16 - (n - 1) * 12, tNow / 1000, ww / SPRITES.wreath.width, wh / SPRITES.wreath.height);
  if (G.stack > 14) textHalo(g, '×' + G.stack, x + P.w * HEAD_CX, y - 16 - 14 * 12 - 20, 2, BLACK, 'center');
  if (G.phase === 'playing' || G.phase === 'won') marquee(g, x - 2, y - 2, P.w + 4, P.h + 4, Math.floor(tNow / 90));
  if (G.phase === 'playing') {
    // Two selection handles above the stack mark where a wreath has to land. They are always there during a run,
    // hollow until a falling wreath is lined up with the stack, then solid.
    const incoming = G.items.find(i => i.kind === 'wreath' && !i.bounced && !i.passedHead);
    {
      const half = (HEAD_R - HEAD_L) / 2 * P.w * PERFECT_ZONE, mid = x + (HEAD_L + HEAD_R) / 2 * P.w;
      const lined = !!incoming && Math.abs(stackOffset(incoming.x + incoming.w / 2, P)) <= PERFECT_ZONE;
      const hy = y - stackHeight() - 8;
      for (const hx of [mid - half, mid + half]) {
        g.fillStyle = BLACK; g.fillRect(Math.round(hx) - 4, hy - 4, 8, 8);
        if (!lined) { g.fillStyle = WHITE; g.fillRect(Math.round(hx) - 2, hy - 2, 4, 4); }
      }
    }
  }
  if (G.landFx > 0) {
    // a wreath just landed: the drawing goes black and white for a moment, then the selection border blinks
    if (G.landFx > LAND_FX - 0.1) {
      g.save(); g.beginPath(); g.rect(x, y, P.w, P.h); g.clip();
      g.globalCompositeOperation = 'saturation'; g.fillStyle = DARK; g.fillRect(x, y, P.w, P.h);   // keeps the light and dark, drops the color
      g.restore();
    }
    if (Math.floor(G.landFx * 20) & 1) {
      g.fillStyle = WHITE; hollowRect(g, x - 5, y - 5, P.w + 10, P.h + 10, 3);
      g.fillStyle = BLACK; hollowRect(g, x - 8, y - 8, P.w + 16, P.h + 16, 3);
    }
  }
  if (G.borderFx > 0) {
    const k = 1 - G.borderFx, grow = 1 + k * 0.08;
    const bw = (P.w + 40) * grow, bh = (P.h + 40) * grow;
    g.drawImage(SPRITES.wreath, Math.round(x + P.w / 2 - bw / 2), Math.round(y + P.h / 2 - bh / 2 + 8), Math.round(bw), Math.round(bh));
  }
}
function drawHUD(g: CanvasRenderingContext2D): void {
  const xpStr = 'XP ' + pad4(G.xp) + '/' + PERFECT_DAY;
  if (G.xpFlash > 0) { g.fillStyle = BLACK; g.fillRect(8, 6, textW(xpStr, 2) + 8, 22); text(g, xpStr, 12, 10, 2, WHITE); }
  else text(g, xpStr, 12, 10, 2, BLACK);
  text(g, 'LEVEL ' + G.level, 12, 30, 2, DARK);
  // XP bar
  g.fillStyle = BLACK; g.fillRect(12, 48, 162, 8);
  g.fillStyle = WHITE; g.fillRect(13, 49, 160, 6);
  g.fillStyle = BLACK; g.fillRect(13, 49, Math.round(160 * G.xp / PERFECT_DAY), 6);
  const mult = multiplier();
  const infinite = G.storm >= STORM_X3;
  const stormStr = infinite ? 'INFINITE  ×' + mult : 'STORM ' + G.storm + '  ×' + mult;
  // while infinite the storm box is inverted; it blinks for a moment when the storm first gets there
  const lit = infinite && (G.infFx <= 0 || (Math.floor(G.infFx * 8) & 1) === 0);
  if (lit) { const sw = textW(stormStr, 2); g.fillStyle = BLACK; g.fillRect(PLAY_W - 12 - sw - 4, 6, sw + 8, 22); text(g, stormStr, PLAY_W - 12, 10, 2, WHITE, 'right'); }
  else text(g, stormStr, PLAY_W - 12, 10, 2, BLACK, 'right');
  if (infinite) text(g, 'STORM ' + G.storm, PLAY_W - 12, 30, 2, DARK, 'right');   // the count keeps going under the box
  else text(g, STORM_X3 + ' FOR INFINITE', PLAY_W - 12, 30, 2, DARK, 'right');    // and until then, what it takes
  text(g, fmtTime(G.t), PLAY_W / 2, 10, 2, DARK, 'center');
}
function drawFloaters(g: CanvasRenderingContext2D): void {
  for (const f of G.floaters) {
    const k = f.t / f.life;
    const y = f.y - k * 46;
    g.globalAlpha = k < 0.55 ? 1 : Math.max(0, 1 - (k - 0.55) / 0.45);   // a smooth fade out, no flicker
    textHalo(g, f.text, clamp(f.x, 60, PLAY_W - 60), y, f.scale, BLACK, 'center');
  }
  g.globalAlpha = 1;
  for (const f of G.flyers) {
    // a small +N on a quadratic arc from the catch to the XP counter, eased so it leaves slowly and arrives quickly
    const k = f.t / f.life, e = k * k;
    const mx = (f.x0 + f.x1) / 2, my = Math.min(f.y0, f.y1) - 70;
    const x = (1 - e) * (1 - e) * f.x0 + 2 * (1 - e) * e * mx + e * e * f.x1;
    const y = (1 - e) * (1 - e) * f.y0 + 2 * (1 - e) * e * my + e * e * f.y1;
    textHalo(g, f.text, x, y, 2, BLACK, 'center');
  }
}
function drawBanner(g: CanvasRenderingContext2D): void {
  if (!G.banner) return;
  const lines = wrap(G.banner.text, 560, 2);
  const w = Math.max(...lines.map(l => textW(l, 2))) + 40, h = lines.length * 20 + 20;
  const x = Math.round(PLAY_W / 2 - w / 2), y = 118;
  g.fillStyle = WHITE; g.fillRect(x, y, w, h);
  g.fillStyle = BLACK; g.fillRect(x, y, w, 2); g.fillRect(x, y + h - 2, w, 2); g.fillRect(x, y, 2, h); g.fillRect(x + w - 2, y, 2, h);
  lines.forEach((l, i) => text(g, l, PLAY_W / 2, y + 10 + i * 20, 2, BLACK, 'center'));
}
function drawPhoto(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  if (!photo) return;
  const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = true;   // a photograph, not pixel art
  g.drawImage(photo, x, y, w, h);
  g.imageSmoothingEnabled = sm;
}
function drawAchDialog(g: CanvasRenderingContext2D): void {
  buttons.length = 0;   // while this is up, only its own button is live
  const w = 780, h = 572, x = (PLAY_W - w) / 2, y = 14;
  dialogBox(g, x, y, w, h);
  text(g, 'ACHIEVEMENTS', PLAY_W / 2, y + 14, 3, BLACK, 'center');
  text(g, everAch.size + ' of ' + ACH_TOTAL + ' earned', PLAY_W / 2, y + 40, 2, DARK, 'center');
  let cy = y + 66;
  for (const id of Object.keys(ACH)) {
    const got = everAch.has(id);
    text(g, (got ? '✓ ' : '  ') + ACH[id], x + 30, cy, 2, got ? BLACK : DARK);
    if (got) text(g, ACH_HOW[id], x + 436, cy, 2, DARK);   // how it was done, only once it has been
    cy += 20;
  }
  // the photo: an empty frame until every achievement has been earned
  const ph = 170, pw = photo ? Math.round(ph * photo.naturalWidth / photo.naturalHeight) : 206;
  const px = Math.round(PLAY_W / 2 - pw / 2), py = cy + 12;
  g.fillStyle = BLACK; g.fillRect(px - 2, py - 2, pw + 4, ph + 4);
  if (everAch.size >= ACH_TOTAL && photo) {
    drawPhoto(g, px, py, pw, ph);
    text(g, 'Perfect day. Wolf form.', PLAY_W / 2, py + ph + 10, 2, DARK, 'center');
  } else {
    g.fillStyle = WHITE; g.fillRect(px, py, pw, ph);
    g.fillStyle = LIGHT; for (let yy = py; yy < py + ph; yy++) for (let xx = px + (yy & 1); xx < px + pw; xx += 2) g.fillRect(xx, yy, 1, 1);
    textHalo(g, 'Locked', PLAY_W / 2, py + ph / 2 - 7, 2, BLACK, 'center');
    text(g, 'All ' + ACH_TOTAL + ' achievements to unlock.', PLAY_W / 2, py + ph + 10, 2, DARK, 'center');
  }
  button(g, 'achclose', 'Close', x + w - 180, y + h - 44, 150, 30);
}
function drawAchievement(g: CanvasRenderingContext2D): void {
  if (!G.achQueue.length) return;
  const name = ACH[G.achQueue[0]];
  const t = G.achT;
  const slide = t < 0.25 ? 1 - t / 0.25 : t > 2.3 + BANNER_LINGER ? (t - 2.3 - BANNER_LINGER) / 0.3 : 0;
  const w = Math.max(textW('ACHIEVEMENT UNLOCKED', 2), textW(name, 2)) + 76, h = 52;
  const x = Math.round(PLAY_W - 12 - w + slide * (w + 24)), y = 52;   // top right, under the storm box; slides in from the edge
  g.fillStyle = BLACK; g.fillRect(x, y, w, h);
  g.fillStyle = WHITE; g.fillRect(x + 2, y + 2, w - 4, h - 4);
  g.fillStyle = BLACK; g.fillRect(x + 4, y + 4, w - 8, h - 8);
  // badge
  const p = new Pix(g, x + 12, y + 10);
  for (let r = 0; r <= 14; r++) p.ellipse(15, 15, r, r, WHITE);
  p.line(8, 15, 13, 20, BLACK); p.line(9, 15, 14, 20, BLACK); p.line(13, 20, 22, 9, BLACK); p.line(14, 20, 23, 9, BLACK);
  text(g, 'ACHIEVEMENT UNLOCKED', x + 56, y + 10, 2, LIGHT);
  text(g, name, x + 56, y + 28, 2, WHITE);
}
function drawEndDialog(g: CanvasRenderingContext2D): void {
  const won = G.phase === 'won';
  const w = 680, x = (PLAY_W - w) / 2;
  // measure first, so the box fits its contents
  const deathLines = won ? [] : wrap(G.deathMsg, w - 60, 2);
  const achList = G.runAch.slice(0, 11);
  const more = G.runAch.length - achList.length;
  const noteLines = wrap(PERSONAL_NOTE, w - 84, 2).slice(0, 4);
  const creditLines = wrap(ART_CREDIT, w - 60, 2).slice(0, 2);
  const headH = won ? 54 + 22 + 26 : deathLines.length * 20 + 6 + 20 + 26;
  const listRows = Math.max(1, achList.length + (more > 0 ? 1 : 0));
  const noteH = noteLines.length * 18 + 20;
  const h = 22 + headH + 22 + listRows * 16 + 14 + noteH + 8 + creditLines.length * 16 + 58;
  const y = Math.round((PLAY_H - h) / 2);
  dialogBox(g, x, y, w, h);
  let cy = y + 22;
  if (won) {
    text(g, 'Indeed.', PLAY_W / 2, cy, 6, BLACK, 'center'); cy += 54;
    text(g, 'A perfect day. ' + PERFECT_DAY + ' XP in ' + fmtTime(G.finishTime) + '.', PLAY_W / 2, cy, 2, BLACK, 'center'); cy += 22;
    if (bestTime) text(g, 'Best time: ' + fmtTime(bestTime), PLAY_W / 2, cy, 2, DARK, 'center'); cy += 26;
  } else {
    deathLines.forEach(l => { text(g, l, PLAY_W / 2, cy, 2, BLACK, 'center'); cy += 20; });
    cy += 6;
    text(g, 'XP ' + G.xp + ' / ' + PERFECT_DAY + '   LEVEL ' + G.level + '   ' + fmtTime(G.t), PLAY_W / 2, cy, 2, BLACK, 'center'); cy += 20;
    text(g, 'Best: ' + bestXP + ' XP', PLAY_W / 2, cy, 2, DARK, 'center'); cy += 26;
  }
  text(g, 'ACHIEVEMENTS THIS RUN: ' + G.runAch.length + '   (' + everAch.size + '/' + ACH_TOTAL + ' ever)', x + 30, cy, 2, BLACK); cy += 22;
  if (!achList.length) text(g, 'None. Which is itself notable.', x + 30, cy, 2, DARK);
  achList.forEach((id, i) => text(g, '✓ ' + ACH[id], x + 30, cy + i * 16, 2, BLACK));
  if (more > 0) text(g, '  and ' + more + ' more.', x + 30, cy + achList.length * 16, 2, DARK);
  cy += listRows * 16 + 14;
  // the personal note
  g.fillStyle = BLACK; g.fillRect(x + 30, cy, w - 60, noteH);
  g.fillStyle = WHITE; g.fillRect(x + 31, cy + 1, w - 62, noteH - 2);
  noteLines.forEach((l, i) => text(g, l, PLAY_W / 2, cy + 10 + i * 18, 2, BLACK, 'center'));
  cy += noteH + 8;
  creditLines.forEach((l, i) => text(g, l, PLAY_W / 2, cy + i * 16, 2, DARK, 'center'));
  // Sierra buttons
  const by = y + h - 48;
  button(g, 'restore', 'Restore', x + 50, by, 150, 30);
  button(g, 'restart', 'Restart', x + w / 2 - 75, by, 150, 30);
  button(g, 'quit', 'Quit', x + w - 200, by, 150, 30);
}
function drawHowto(g: CanvasRenderingContext2D): void {
  const w = 700, h = 494, x = (PLAY_W - w) / 2, y = (PLAY_H - h) / 2;
  dialogBox(g, x, y, w, h);
  let cy = y + 18;
  text(g, 'WREATH QUEST', PLAY_W / 2, cy, 3, BLACK, 'center'); cy += 28;
  text(g, 'Quest for the Head', PLAY_W / 2, cy, 2, DARK, 'center'); cy += 30;
  const legend = (title: string, lx: number, kinds: Kind[]) => {
    text(g, title, lx, cy, 2, BLACK); cy += 22;
    for (const k of kinds) {
      const s = SPRITES[k];
      g.drawImage(s, Math.round(lx + 30 - s.width / 2), Math.round(cy + 20 - s.height / 2));
      text(g, KINDS[k].label, lx + 70, cy + 13, 2, BLACK);
      cy += 50;
    }
  };
  const top = cy;
  legend('CATCH', x + 50, ['wreath', 'pellegrino', 'card', 'heart', 'steak']);
  cy = top;
  legend('AVOID', x + w / 2 + 30, ['beach', 'dasani', 'counterspell', 'comforter', 'sugar']);
  cy += 6;
  for (const l of ['Mouse, ← →, or A and D. P pauses. M mutes.', 'One minute is one XP.', PERFECT_DAY + ' XP is a perfect day.', 'Two things at once is double XP.']) { text(g, l, PLAY_W / 2, cy, 2, BLACK, 'center'); cy += 18; }
  button(g, 'begin', 'Begin', PLAY_W / 2 - 75, y + h - 50, 150, 30);
}
function drawTitle(g: CanvasRenderingContext2D): void {
  g.drawImage(titleArt, 0, 0);
  const y0 = titleArt.height;
  g.fillStyle = WHITE; g.fillRect(0, y0, PLAY_W, PLAY_H - y0);
  text(g, 'WREATH QUEST', PLAY_W / 2, y0 + 14, 4, BLACK, 'center');
  text(g, 'Quest for the Head', PLAY_W / 2, y0 + 50, 2, DARK, 'center');
  if (Math.floor(performance.now() / 500) & 1) text(g, 'Click, or press Space.', PLAY_W / 2, y0 + 84, 2, BLACK, 'center');
  const best = bestXP ? 'Best: ' + bestXP + ' XP' + (bestTime ? '   Best perfect day: ' + fmtTime(bestTime) : '') : '';
  const lines = wrap(best || ART_CREDIT, PLAY_W - 60, 2);
  lines.forEach((l, i) => text(g, l, PLAY_W / 2, y0 + 112 + i * 16, 2, DARK, 'center'));
}
function render(tNow: number): void {
  buttons = [];
  ctx.drawImage(chrome, 0, 0);
  const soundMenu = menuRects.find(m => m.label === 'Sound')!;
  text(ctx, soundOn ? 'Sound' : 'Sound: off', soundMenu.x + 6, FRAME + TITLE_H + 4, 2, soundOn ? BLACK : DARK);
  // status bar text
  const sy = STATUS_Y + 6;
  const defaultStatus = G.phase === 'playing' ? 'Wreaths go on the head.' : 'For Help, click Help.';
  ctx.save();
  ctx.beginPath(); ctx.rect(FRAME + 4, sy - 2, WIN_W - 310 - FRAME, STATUS_H - 6); ctx.clip();   // each pane clips its own text
  text(ctx, G.statusT > 0 ? G.status : defaultStatus, FRAME + 8, sy, 2, BLACK);
  ctx.restore();
  const undoText = G.phase === 'title' || G.phase === 'howto' ? 'UNDO: ' + START_UNDOS : 'UNDO: ' + G.undos + (G.undos === 1 ? ' (LAST)' : '');
  ctx.save();
  ctx.beginPath(); ctx.rect(WIN_W - 300, sy - 2, 172, STATUS_H - 6); ctx.clip();
  text(ctx, undoText, WIN_W - 296, sy, 2, G.undos === 1 && G.phase === 'playing' && (Math.floor(tNow / 300) & 1) ? DARK : BLACK);
  ctx.restore();
  text(ctx, PLAY_W + ' x ' + PLAY_H, WIN_W - 118, sy, 2, BLACK);

  // the image
  ctx.save();
  ctx.translate(PLAY_X, PLAY_Y);
  ctx.beginPath(); ctx.rect(0, 0, PLAY_W, PLAY_H); ctx.clip();
  ctx.fillStyle = WHITE; ctx.fillRect(0, 0, PLAY_W, PLAY_H);
  if (G.phase === 'title') drawTitle(ctx);
  else if (G.phase === 'howto') drawHowto(ctx);
  else {
    for (const it of G.items) drawItem(ctx, it);
    drawHUD(ctx);
    drawFloaters(ctx);
    drawPortrait(ctx, tNow);
    drawBanner(ctx);
    if (G.paused && G.phase === 'playing') {
      ctx.fillStyle = WHITE; ctx.fillRect(PLAY_W / 2 - 90, 240, 180, 60);
      ctx.fillStyle = BLACK; ctx.fillRect(PLAY_W / 2 - 90, 240, 180, 2); ctx.fillRect(PLAY_W / 2 - 90, 298, 180, 2); ctx.fillRect(PLAY_W / 2 - 90, 240, 2, 60); ctx.fillRect(PLAY_W / 2 + 88, 240, 2, 60);
      text(ctx, 'PAUSED', PLAY_W / 2, 252, 3, BLACK, 'center');
      text(ctx, 'P to continue', PLAY_W / 2, 278, 2, DARK, 'center');
    }
    if (G.phase === 'over' || G.phase === 'won') drawEndDialog(ctx);
  }
  drawAchievement(ctx);   // toasts show on every screen; some achievements come from the title
  if (achOpen) drawAchDialog(ctx);
  ctx.restore();
}

// ============================================================================
//  Input
// ============================================================================
function toLogical(e: MouseEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * WIN_W / r.width, y: (e.clientY - r.top) * WIN_H / r.height };
}
function hitButton(x: number, y: number): Btn | null {
  const px = x - PLAY_X, py = y - PLAY_Y;
  for (const b of buttons) if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) return b;
  return null;
}
function onButton(id: string): void {
  switch (id) {
    case 'begin': startRun(); break;
    case 'achclose': achOpen = false; break;
    case 'restart': startRun(); break;
    case 'restore':
      if (restoreArmed > performance.now()) { restoreArmed = 0; resetProgress(); G.phase = 'title'; G.items = []; }   // and back to the title, like a fresh install
      else { restoreArmed = performance.now() + 5000; SFX.undo(); setStatus('Clears records and the photo. Click again.', 5); }
      break;
    case 'quit': SFX.click(); G.phase = 'title'; G.items = []; setStatus('Quit to where?', 4); break;
  }
}
function chromeClick(x: number, y: number): boolean {
  if (y >= FRAME + TITLE_H && y < FRAME + TITLE_H + MENU_H) {
    for (const m of menuRects) if (x >= m.x && x < m.x + m.w) {
      if (m.label === 'Sound') { setSound(!soundOn); if (soundOn) SFX.click(); }
      else if (m.label === 'Help') {
        if (G.phase === 'playing') { G.paused = true; setStatus('Help: wreaths go on the head. Paused.', 4); }
        else if (G.phase === 'title') G.phase = 'howto';
        else setStatus('Help: wreaths go on the head.', 4);
      }
      else if (m.label === 'Edit') setStatus('Undo  Ctrl+Z    (Nothing to undo.)', 4);
      else if (m.label === 'File') setStatus('Save As...  untitled.bmp  (It will not save.)', 4);
      else if (m.label === 'Image') setStatus('Invert Colors: still gray.', 4);
      else if (m.label === 'View') setStatus('View: this is the view.', 4);
      else if (m.label === 'Achievements') { achOpen = true; if (G.phase === 'playing') G.paused = true; SFX.click(); }
      else setStatus('Options: there are no options. It is 1995.', 4);
      return true;
    }
  }
  if (y >= PALETTE_Y && y < STATUS_Y) {
    for (const p of paletteRects) if (x >= p.x && x < p.x + 16 && y >= p.y && y < p.y + 16) { SFX.click(); unlock('palette'); setStatus('They are all gray.', 4); return true; }
    if (x < FRAME + 40) { setStatus('Foreground: black. Background: white. Correct.', 4); return true; }
  }
  if (x < PLAY_X - PAD && y > FRAME + TITLE_H + MENU_H && y < PALETTE_Y) {
    // the toolbox: a 2 x 8 grid of 25 px buttons on a 26 px pitch (see the toolbar drawing)
    const tx = FRAME + 4, ty = FRAME + TITLE_H + MENU_H + 4;
    const col = Math.floor((x - tx) / 26), row = Math.floor((y - ty) / 26);
    if (col >= 0 && col < 2 && row >= 0 && row < 8 && (x - tx) % 26 < 25 && (y - ty) % 26 < 25) {
      const i = row * 2 + col, msg = TOOL_MSGS[i];
      if (msg) {
        G.toolPress = i; G.toolPressUntil = performance.now() + 160; SFX.click(); setStatus(msg, 4);
        toolsFound.add(i); if (toolsFound.size >= TOOLS_TO_FIND) unlock('tools');
      }
    }
    return true;   // every other tool, and the options box, does nothing. No movement, no message.
  }
  return false;
}
canvas.addEventListener('mousemove', e => {
  const { x, y } = toLogical(e);
  G.mouseX = x - PLAY_X; G.mouseY = y - PLAY_Y;
  const b = hitButton(x, y);
  G.hover = b ? b.id : null;
  if (G.phase === 'playing' && !G.bot) {
    G.usingKeys = false;
    G.targetX = G.mouseX - HEAD_CX * portrait.width;
  }
});
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  ensureAudio();
  const { x, y } = toLogical(e);
  const b = hitButton(x, y);
  if (b) { onButton(b.id); G.hover = null; return; }
  if (achOpen) { achOpen = false; return; }   // any click outside its button closes the Achievements dialog
  if (chromeClick(x, y)) return;
  if (G.phase === 'title') G.phase = 'howto';
  else if (G.phase === 'howto') startRun();
  else if (G.phase === 'playing' && G.paused) G.paused = false;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  const k = e.key;
  ensureAudio();
  if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) {
    e.preventDefault();
    SFX.undo();
    setStatus('Nothing to undo.', 3);
    return;
  }
  if (!e.ctrlKey && !e.metaKey && !e.altKey && (k === 'm' || k === 'M')) { setSound(!soundOn); if (soundOn) SFX.click(); return; }
  if ((e.ctrlKey || e.metaKey) && (k === 's' || k === 'S')) { e.preventDefault(); setStatus('Saved as untitled.bmp. (It was not.)', 4); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (achOpen && (k === 'Escape' || k === ' ' || k === 'Enter')) { achOpen = false; SFX.click(); e.preventDefault(); return; }
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') { G.keys.left = true; e.preventDefault(); }
  if (k === 'ArrowRight' || k === 'd' || k === 'D') { G.keys.right = true; e.preventDefault(); }
  if (k === ' ' || k === 'Enter') {
    e.preventDefault();
    if (G.phase === 'title') G.phase = 'howto';
    else if (G.phase === 'howto') startRun();
    else if (G.phase === 'over' || G.phase === 'won') startRun();
    else if (G.phase === 'playing' && G.paused) G.paused = false;
  }
  if ((k === 'p' || k === 'P' || k === 'Escape') && G.phase === 'playing') { G.paused = !G.paused; SFX.click(); e.preventDefault(); }
});
window.addEventListener('keyup', e => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') G.keys.left = false;
  if (k === 'ArrowRight' || k === 'd' || k === 'D') G.keys.right = false;
});
window.addEventListener('blur', () => { if (G.phase === 'playing') G.paused = true; G.keys.left = G.keys.right = false; });

// ============================================================================
//  Boot
// ============================================================================
function fit(): void {
  const s = Math.min((window.innerWidth - 8) / WIN_W, (window.innerHeight - 8) / WIN_H);
  canvas.style.width = Math.floor(WIN_W * s) + 'px';
  canvas.style.height = Math.floor(WIN_H * s) + 'px';
}
window.addEventListener('resize', fit);

let last = 0;
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  update(dt);
  musicTick();
  render(now);
  requestAnimationFrame(frame);
}

const img = new Image();
img.onload = () => {
  const pw = Math.round(CROP.w * PORTRAIT_H / CROP.h);
  portrait = resample(img, CROP.x, CROP.y, CROP.w, CROP.h, pw, PORTRAIT_H);
  titleArt = resample(img, 0, 0, img.naturalWidth, img.naturalHeight, PLAY_W, Math.round(img.naturalHeight * PLAY_W / img.naturalWidth));
  buildChrome();
  G.px = (PLAY_W - portrait.width) / 2; G.targetX = G.px;
  fit();
  if (location.hash === '#bot') G.bot = true;
  if (location.hash === '#debug' || location.hash === '#bot') (window as unknown as { __wq: unknown }).__wq = { G, startRun, update, KINDS, audio: () => ({ state: ac ? ac.state : 'none', notes: notesScheduled, mode: music.mode, soundOn, master: ac ? masterGain.gain.value : -1 }), scheduleStep, notes: () => notesScheduled };
  requestAnimationFrame(frame);
};
img.src = (window as unknown as { __WQ_ART__: string }).__WQ_ART__;
const photoImg = new Image();   // loads in the background; nothing waits on it
photoImg.onload = () => { photo = photoImg; };
photoImg.src = (window as unknown as { __WQ_PHOTO__: string }).__WQ_PHOTO__;
})();
