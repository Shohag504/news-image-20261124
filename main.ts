// The World Today — 24 November 2026.
// A deterministic news-image renderer (Node 22, standard library only).
// It draws the day's five verified stories as a newspaper front page and
// writes entry.png (1024x1024). No network, no randomness, no timestamps:
// the same run always writes the same bytes.
//
// Stories (all first reported on Tuesday 24 November 2026):
//  1. Russian warplanes entered South Korea's air defence zone near
//     Ulleung Island; Seoul scrambled jets and islanders were told to
//     take shelter (Yonhap / AP).
//  2. Three oil tankers caught fire in the Strait of Hormuz after hitting
//     sea mines; Iran said it shot down a US drone; the US widened its
//     Iran sanctions (Dawn live blog / Geo.tv).
//  3. A Saudi strike on buses and trucks in Yemen's Lahj province left
//     25 people dead or missing (Reuters, via Houthi-run Saba).
//  4. Leaked Russian state records put the war dead in Ukraine near
//     500,000, new Guardian and Bloomberg analyses say.
//  5. Markets roared back: the Nasdaq rose 6.5% as Nvidia jumped 28%+
//     on Jensen Huang's return as CEO; Asian shares rallied (Kalkine).
//
// Usage: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- PNG out
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

// Encode an RGB buffer (width*height*3) as a deterministic PNG.
function encodePng(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; // filter: none
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------ 5x7 font
// Each glyph: 7 rows, 5 bits each (bit 4 = leftmost pixel).
type Glyph = [number, number, number, number, number, number, number];
const FONT: Record<string, Glyph> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  '3': [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  '6': [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0b01100, 0b01100],
  ',': [0, 0, 0, 0, 0b01100, 0b00100, 0b01000],
  ':': [0, 0b01100, 0b01100, 0, 0b01100, 0b01100, 0],
  ';': [0, 0b01100, 0b01100, 0, 0b01100, 0b00100, 0b01000],
  '!': [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100],
  '?': [0b01110, 0b10001, 0b00001, 0b00110, 0b00100, 0, 0b00100],
  "'": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
  '"': [0b01010, 0b01010, 0, 0, 0, 0, 0],
  '-': [0, 0, 0, 0b01110, 0, 0, 0],
  '+': [0, 0b00100, 0b00100, 0b01110, 0b00100, 0b00100, 0],
  '%': [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  '/': [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000],
  '(': [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
  ')': [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  '&': [0b01100, 0b10010, 0b10100, 0b01000, 0b10101, 0b10010, 0b01101],
  $: [0b00100, 0b01111, 0b10100, 0b01110, 0b00101, 0b11110, 0b00100],
  '=': [0, 0, 0b11111, 0, 0b11111, 0, 0],
  '>': [0b10000, 0b01000, 0b00100, 0b00010, 0b00100, 0b01000, 0b10000],
  '<': [0b00001, 0b00010, 0b00100, 0b01000, 0b00100, 0b00010, 0b00001],
  '•': [0, 0, 0b01100, 0b01100, 0b01100, 0, 0],
};

// ------------------------------------------------------------- canvas
type RGB = [number, number, number];

const PAPER: RGB = [246, 241, 230];
const INK: RGB = [26, 26, 26];
const NAVY: RGB = [18, 40, 64];
const NAVY2: RGB = [28, 58, 90];
const RED: RGB = [179, 38, 30];
const WHITE: RGB = [255, 255, 255];
const SEA: RGB = [127, 179, 213];
const SEA_DARK: RGB = [46, 109, 164];
const SEA_DEEP: RGB = [24, 68, 110];
const SAND: RGB = [232, 220, 192];
const GREEN: RGB = [30, 125, 50];
const ORANGE: RGB = [224, 122, 26];
const GOLD: RGB = [212, 160, 32];
const GREY: RGB = [110, 110, 105];
const LIGHT_LINE: RGB = [200, 190, 170];

class Canvas {
  readonly w: number;
  readonly h: number;
  private buf: Uint8Array;

  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8Array(w * h * 3);
    this.fillRect(0, 0, w, h, bg);
  }

  px(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
  }

  rect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
    this.fillRect(x, y, w, t, c);
    this.fillRect(x, y + h - t, w, t, c);
    this.fillRect(x, y, t, h, c);
    this.fillRect(x + w - t, y, t, h, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) this.px(x + a, y + b, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }

  circle(cx: number, cy: number, r: number, c: RGB, filled: boolean): void {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (filled ? d <= r : d <= r && d > r - 2) this.px(cx + x, cy + y, c);
      }
    }
  }

  // Filled triangle.
  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
    const minX = Math.min(x0, x1, x2);
    const maxX = Math.max(x0, x1, x2);
    const minY = Math.min(y0, y1, y2);
    const maxY = Math.max(y0, y1, y2);
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (area === 0) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const w0 = (x1 - x) * (y2 - y) - (x2 - x) * (y1 - y);
        const w1 = (x2 - x) * (y0 - y) - (x0 - x) * (y2 - y);
        const w2 = (x0 - x) * (y1 - y) - (x1 - x) * (y0 - y);
        if ((area > 0 && w0 >= 0 && w1 >= 0 && w2 >= 0) || (area < 0 && w0 <= 0 && w1 <= 0 && w2 <= 0)) {
          this.px(x, y, c);
        }
      }
    }
  }

  // One glyph, top-left at (x, y), scaled by s.
  glyph(ch: string, x: number, y: number, s: number, c: RGB): void {
    const g = FONT[ch];
    if (!g) return;
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if ((g[row] >> (4 - col)) & 1) this.fillRect(x + col * s, y + row * s, s, s, c);
      }
    }
  }

  textWidth(s: string, scale: number): number {
    const up = s.toUpperCase().replace(/[’‘]/g, "'").replace(/[–—]/g, '-');
    return up.length * 6 * scale - scale;
  }

  text(s: string, x: number, y: number, scale: number, c: RGB): number {
    const up = s.toUpperCase().replace(/[’‘]/g, "'").replace(/[–—]/g, '-');
    let cx = x;
    for (const ch of up) {
      this.glyph(ch, cx, y, scale, c);
      cx += 6 * scale;
    }
    return cx;
  }

  // Word-wrap text into lines of at most maxW pixels; returns lines used.
  para(s: string, x: number, y: number, maxW: number, scale: number, c: RGB, lh: number): number {
    const words = s.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (this.textWidth(test, scale) <= maxW) {
        cur = test;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    lines.forEach((ln, i) => this.text(ln, x, y + i * lh, scale, c));
    return lines.length;
  }

  toPng(): Buffer {
    return encodePng(this.w, this.h, this.buf);
  }
}

// ------------------------------------------------------------ the page
function drawPage(): Canvas {
  const W = 1024;
  const H = 1024;
  const cv = new Canvas(W, H, PAPER);
  const M = 28; // margin

  // ---- masthead ------------------------------------------------------
  cv.fillRect(0, 0, W, 148, NAVY);
  cv.fillRect(0, 148, W, 5, RED);
  const title = 'THE WORLD TODAY';
  const tw = cv.textWidth(title, 6);
  cv.text(title, (W - tw) / 2, 30, 6, WHITE);
  const date = 'TUESDAY 24 NOVEMBER 2026';
  const dw = cv.textWidth(date, 3);
  cv.text(date, (W - dw) / 2, 96, 3, [232, 196, 120]);
  cv.text('FIVE STORIES, ONE DAY', M, 96, 2, [180, 200, 220]);
  cv.text('NO. 24 NOV 2026', W - M - cv.textWidth('NO. 24 NOV 2026', 2), 96, 2, [180, 200, 220]);

  // ---- lead story: Korea air scare -----------------------------------
  const lx = M;
  const ly = 172;
  const lw = 620;
  const lh = 360;
  cv.fillRect(lx, ly, lw, lh, WHITE);
  cv.rect(lx, ly, lw, lh, INK, 2);
  // sea scene at the top of the panel
  const sceneH = 140;
  cv.fillRect(lx + 2, ly + 2, lw - 4, sceneH, SEA);
  for (let i = 0; i < 5; i++) {
    cv.fillRect(lx + 2, ly + 22 + i * 26, lw - 4, 3, SEA_DARK);
  }
  // island
  cv.fillRect(lx + 60, ly + 92, 170, 48, [46, 110, 70]);
  cv.tri(lx + 60, ly + 140, lx + 145, ly + 70, lx + 230, ly + 140, [46, 110, 70]);
  cv.tri(lx + 130, ly + 140, lx + 185, ly + 88, lx + 250, ly + 140, [34, 88, 56]);
  // radar rings + jets
  cv.circle(lx + 480, ly + 70, 50, WHITE, false);
  cv.circle(lx + 480, ly + 70, 32, WHITE, false);
  cv.circle(lx + 480, ly + 70, 14, WHITE, false);
  cv.tri(lx + 380, ly + 40, lx + 424, ly + 54, lx + 380, ly + 68, INK);
  cv.tri(lx + 452, ly + 80, lx + 496, ly + 94, lx + 452, ly + 108, INK);
  cv.tri(lx + 330, ly + 104, lx + 366, ly + 116, lx + 330, ly + 128, INK);
  // alert banner
  cv.fillRect(lx + 2, ly + 2, 300, 34, RED);
  cv.text('AIR RAID ALERT 07:52', lx + 16, ly + 10, 2, WHITE);
  // headline + body
  const tx = lx + 18;
  let ty = ly + sceneH + 16;
  cv.text('KOREA', tx, ty, 3, RED);
  ty += 26;
  cv.text('JETS SCRAMBLED AS', tx, ty, 3, INK);
  ty += 26;
  cv.text('WARPLANES NEAR', tx, ty, 3, INK);
  ty += 26;
  cv.text('ULLEUNG ISLAND', tx, ty, 3, INK);
  ty += 34;
  cv.para(
    'Russian warplanes entered South Korea\u2019s air defence zone near Ulleung Island and Seoul scrambled jets. Islanders were told to shelter at 7:52am; the alert was lifted five minutes later. No airspace violation, the military said.',
    tx, ty, lw - 36, 2, INK, 18,
  );

  // ---- right story: Gulf / Hormuz ------------------------------------
  const rx = lx + lw + 16;
  const rw = W - M - rx;
  const ry = ly;
  const rh = lh;
  cv.fillRect(rx, ry, rw, rh, WHITE);
  cv.rect(rx, ry, rw, rh, INK, 2);
  // tanker scene
  const gs = 120;
  cv.fillRect(rx + 2, ry + 2, rw - 4, gs, SEA_DEEP);
  for (let i = 0; i < 4; i++) cv.fillRect(rx + 2, ry + 20 + i * 26, rw - 4, 3, SEA_DARK);
  // tanker hull + containers
  cv.fillRect(rx + 34, ry + 78, 220, 22, [40, 40, 40]);
  cv.fillRect(rx + 44, ry + 50, 44, 28, ORANGE);
  cv.fillRect(rx + 94, ry + 50, 44, 28, GOLD);
  cv.fillRect(rx + 144, ry + 50, 44, 28, RED);
  cv.fillRect(rx + 200, ry + 60, 34, 18, WHITE);
  // flames
  cv.tri(rx + 96, ry + 50, rx + 116, ry + 10, rx + 136, ry + 50, ORANGE);
  cv.tri(rx + 150, ry + 50, rx + 166, ry + 20, rx + 182, ry + 50, GOLD);
  cv.tri(rx + 60, ry + 50, rx + 72, ry + 28, rx + 84, ry + 50, ORANGE);
  // smoke
  cv.circle(rx + 116, ry + 14, 11, [90, 90, 90], true);
  cv.circle(rx + 150, ry + 8, 8, [120, 120, 120], true);
  const gx = rx + 16;
  let gy = ry + gs + 16;
  cv.text('THE GULF', gx, gy, 3, RED);
  gy += 26;
  cv.text('TANKERS BURN', gx, gy, 3, INK);
  gy += 26;
  cv.text('IN HORMUZ', gx, gy, 3, INK);
  gy += 26;
  cv.text('AFTER MINES', gx, gy, 3, INK);
  gy += 34;
  cv.para(
    'Three oil tankers caught fire in the Strait of Hormuz after hitting sea mines, Iran\u2019s navy said. Tehran said it also downed a US drone.',
    gx, gy, rw - 32, 2, INK, 17,
  );

  // ---- middle row: three stories --------------------------------------
  const my = ly + lh + 18;
  const mh = 290;
  const mw = (W - 2 * M - 32) / 3;
  const mids: Array<{
    tag: string;
    head: string[];
    body: string;
    art: (x: number, y: number, w: number) => void;
  }> = [
    {
      tag: 'YEMEN',
      head: ['SAUDI STRIKES IN', 'YEMEN LEAVE 25', 'DEAD OR MISSING'],
      body: 'A Saudi strike on buses and trucks in Lahj left 25 people dead or missing and six wounded, Houthi media said.',
      art: (x, y, w) => {
        cv.fillRect(x, y, w, 56, SAND);
        cv.fillRect(x + 18, y + 26, 70, 20, [90, 70, 40]);
        cv.fillRect(x + 96, y + 18, 56, 28, [120, 95, 55]);
        cv.tri(x + 170, y + 46, x + 190, y + 6, x + 210, y + 46, ORANGE);
        cv.tri(x + 210, y + 46, x + 226, y + 18, x + 242, y + 46, GOLD);
        cv.circle(x + 190, y + 10, 8, [90, 90, 90], true);
      },
    },
    {
      tag: 'UKRAINE WAR',
      head: ['LEAKED RECORDS', 'PUT WAR DEAD', 'NEAR 500,000'],
      body: 'Analyses of hacked Russian records count 460,000+ war-linked deaths since 2022, the Guardian and Bloomberg report.',
      art: (x, y, w) => {
        cv.fillRect(x, y, w, 56, [232, 232, 228]);
        const bars = [16, 24, 20, 36, 46];
        bars.forEach((b, i) => {
          cv.fillRect(x + 20 + i * 52, y + 52 - b, 34, b, i === 4 ? RED : GREY);
        });
        cv.line(x + 12, y + 52, x + w - 12, y + 52, INK, 2);
      },
    },
    {
      tag: 'MARKETS',
      head: ['MARKETS ROAR', 'BACK AS NVIDIA', 'JUMPS 28%'],
      body: 'The Nasdaq surged 6.5% after Nvidia\u2019s rebound on Jensen Huang\u2019s return as CEO. Asian shares rallied; Brent fell below $90.',
      art: (x, y, w) => {
        cv.fillRect(x, y, w, 56, [226, 240, 226]);
        cv.line(x + 16, y + 46, x + 70, y + 36, GREEN, 3);
        cv.line(x + 70, y + 36, x + 120, y + 38, GREEN, 3);
        cv.line(x + 120, y + 38, x + 180, y + 20, GREEN, 3);
        cv.line(x + 180, y + 20, x + w - 16, y + 10, GREEN, 3);
        cv.tri(x + w - 30, y + 2, x + w - 30, y + 18, x + w - 12, y + 10, GREEN);
      },
    },
  ];
  mids.forEach((m, i) => {
    const x = M + i * (mw + 16);
    cv.fillRect(x, my, mw, mh, WHITE);
    cv.rect(x, my, mw, mh, INK, 2);
    m.art(x + 2, my + 2, mw - 4);
    let yy = my + 70;
    cv.text(m.tag, x + 14, yy, 2, RED);
    yy += 24;
    for (const ln of m.head) {
      cv.text(ln, x + 14, yy, 3, INK);
      yy += 26;
    }
    yy += 6;
    cv.para(m.body, x + 14, yy, mw - 28, 2, INK, 17);
  });

  // ---- ticker ---------------------------------------------------------
  const ty2 = my + mh + 18;
  cv.fillRect(M, ty2, W - 2 * M, 52, NAVY);
  cv.text(
    'OIL NEAR 3-MONTH LOWS  •  TRUMP: IRAN STRIKES COULD RESUME IN NEW YEAR',
    M + 14, ty2 + 17, 2, WHITE,
  );

  // ---- footer ---------------------------------------------------------
  const fy = ty2 + 52 + 14;
  const foot = 'SOURCES: YONHAP, AP, REUTERS, DAWN, GUARDIAN, BLOOMBERG — 24 NOVEMBER 2026';
  cv.text(foot, (W - cv.textWidth(foot, 2)) / 2, fy, 2, GREY);
  cv.fillRect(M, fy + 26, W - 2 * M, 3, LIGHT_LINE);
  const sig = 'THE WORLD TODAY — 24 NOVEMBER 2026';
  cv.text(sig, (W - cv.textWidth(sig, 2)) / 2, fy + 40, 2, INK);

  return cv;
}

// ---------------------------------------------------------------- main
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const png = drawPage().toPng();
writeFileSync(join(outDir, 'entry.png'), png);
