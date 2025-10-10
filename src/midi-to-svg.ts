/*
midi-to-svg.ts

TypeScript module to render a MIDI file into an infinitely-zoomable SVG "work of art":
- overlays all tracks (notes accumulate visually)
- darker where more notes overlap (uses mix-blend-mode: multiply)
- infers timbre from MIDI program numbers and assigns hue
- blur/glow added based on note velocity
- reverb tails rendered as gradient trails
- faint staff/grid lines (pitch rows + measure verticals)

Dependencies (install via npm):
  npm install @tonejs/midi

Usage:

  import fs from 'node:fs';
  import { renderMidiToSVG } from './midi-to-svg';

  const buf = fs.readFileSync('example.mid');
  const svg = await renderMidiToSVG(buf.buffer, { width: 5000, height: 1200, pxPerSecond: 300 });
  fs.writeFileSync('out.svg', svg);

Could run in a browser with minor I/O changes.
*/

import { Midi } from '@tonejs/midi';

export type RenderOptions = {
  width?: number;
  height?: number;
  pxPerSecond?: number;
  pitchRange?: [number, number];
  noteHeight?: number;
  background?: string;
  showGrid?: boolean;
  gridOpacity?: number;
};

type NoteRect = {
  midi: number;
  start: number;
  end: number;
  velocity: number;
  program: number | null;
  channel: number;
  trackName: string;
};

const DEFAULTS: RenderOptions = {
  width: 2048,
  height: 800,
  pxPerSecond: undefined,
  pitchRange: [21, 108],
  noteHeight: 6,
  background: '#ffffff',
  showGrid: true,
  gridOpacity: 0.08,
};

// Map General MIDI programs to a hue for each instrument family
function programToHue(program: number | null | undefined): number {
  if (program == null) return 200;
  if (program >= 0 && program <= 7) return 195;
  if (program >= 8 && program <= 15) return 210;
  if (program >= 16 && program <= 31) return 50;
  if (program >= 32 && program <= 39) return 40;
  if (program >= 40 && program <= 55) return 38;
  if (program >= 56 && program <= 63) return 10;
  if (program >= 64 && program <= 71) return 150;
  if (program >= 72 && program <= 79) return 275;
  if (program >= 80 && program <= 87) return 300;
  if (program >= 88 && program <= 95) return 340;
  if (program >= 96 && program <= 103) return 25;
  return 200;
}

// Convert HSL to CSS string
function hsl(h: number, s: number, l: number) {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}


export async function renderMidiToSVG(
  midiArrayBuffer: ArrayBuffer | Uint8Array,
  opts?: RenderOptions
): Promise<string> {
  const o = { ...DEFAULTS, ...(opts || {}) };

  const midi = new Midi(midiArrayBuffer as any);

  // Determine pitch bounds
  let [minP, maxP] = o.pitchRange!;
  if (!opts || !opts.pitchRange) {
    for (const track of midi.tracks) {
      for (const note of track.notes) {
        if (note.midi < minP) minP = note.midi;
        if (note.midi > maxP) maxP = note.midi;
      }
    }
    minP = Math.max(0, minP - 2);
    maxP = Math.min(127, maxP + 2);
    if (maxP <= minP) maxP = minP + 12;
  }

  const pitchSpan = maxP - minP + 1;

  // Compute vertical margins
  const verticalMargin = Math.max(40, (o.height! * 0.1)); // 10% top/bottom margin

  // If noteHeight wasn’t specified, scale to fit all pitches in the available height
  if (!opts?.noteHeight) {
    o.noteHeight = (o.height! - verticalMargin * 2) / pitchSpan;
    console.log('Set noteHeight', o.noteHeight)
  }

  // First, collect all notes to determine maxTime
  const allNotes: NoteRect[] = [];
  let maxTime = 0;

  for (const track of midi.tracks) {
    const program = track.instrument.number ?? null;
    const channel = track.channel ?? 0;
    const trackName = track.name || track.instrument.name || 'trk';
    for (const note of track.notes) {
      allNotes.push({
        midi: note.midi,
        start: note.time,
        end: note.time + note.duration,
        velocity: note.velocity ?? 0.5,
        program,
        channel,
        trackName,
      });
      if (note.time + note.duration > maxTime) maxTime = note.time + note.duration;
    }
  }

  // Compute pxPerSecond if not set
  if (!o.pxPerSecond) {
    o.pxPerSecond = o.width! / maxTime;
  }

  const xForTime = (t: number) => Math.round(t * o.pxPerSecond!);
  const yForPitch = (p: number) => Math.round(
    verticalMargin + (maxP - p) * o.noteHeight! + o.noteHeight! / 2
  );

  // Build rects with colors, positions
  type RenderedRect = {
    x: number; y: number; w: number; h: number;
    color: string; velocity: number; program: number | null; channel: number;
    noteId: string; start: number; end: number;
  };

  const rects: RenderedRect[] = [];
  for (const note of allNotes) {
    const x = xForTime(note.start);
    const x2 = xForTime(note.end);
    const w = Math.max(1, x2 - x);
    const h = Math.max(1, o.noteHeight! * 0.9);
    const y = yForPitch(note.midi) - h / 2;
    const hue = programToHue(note.program);
    const sat = Math.min(90, 30 + note.velocity * 70);
    const light = Math.max(15, 60 - note.velocity * 40);
    const color = hsl(hue, sat, light);

    rects.push({
      x, y, w, h, color,
      velocity: note.velocity, program: note.program, channel: note.channel,
      noteId: `${note.trackName}-${note.midi}-${note.start}`,
      start: note.start, end: note.end,
    });
  }

  const svgWidth = Math.max(o.width!, xForTime(maxTime) + 200);
  const svgHeight = o.height!;

  // Build blur defs
  const blurLevels = [0, 1, 2, 4, 8, 14];
  const blurDefs = blurLevels.map(b => `<filter id="blur${b}"><feGaussianBlur stdDeviation="${b}"/></filter>`).join('\n');

  // Build gradient defs
  const gradSet = new Map<string, { h: number, vel: number, id?: string }>();
  rects.forEach(r => {
    const velBin = Math.floor(r.velocity * 4);
    const key = `${r.color}_${velBin}_${r.program}`;
    if (!gradSet.has(key)) gradSet.set(key, { h: r.program != null ? programToHue(r.program) : 200, vel: velBin });
  });

  const gradDefs: string[] = [];
  let gi = 0;
  for (const [k, v] of gradSet.entries()) {
    const id = `grad${gi}`;
    const col = hsl(v.h, 60, 50);
    gradDefs.push(`
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${col}" stop-opacity="${0.9 - v.vel * 0.12}"/>
        <stop offset="60%" stop-color="${col}" stop-opacity="${0.4 - v.vel * 0.08}"/>
        <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
      </linearGradient>
    `);
    gradSet.set(k, { ...v, id });
    gi++;
  }

  // Compose defs
  const defs = `
    <defs>
      ${blurDefs}
      ${gradDefs.join('\n')}
      <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
        <feOffset in="blur" dx="0" dy="1" result="off"/>
        <feMerge>
          <feMergeNode in="off"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
  `;

  // Build staff/grid lines
  const staffLines: string[] = [];
  if (o.showGrid) {
    for (let p = minP; p <= maxP; p++) {
      const y = yForPitch(p);
      const isOct = p % 12 === 0;
      staffLines.push(`<line x1="0" y1="${y}" x2="${svgWidth}" y2="${y}" stroke="#000" stroke-opacity="${o.gridOpacity! * (isOct ? 1.2 : 1)}" stroke-width="${isOct ? 0.5 : 0.35}" stroke-dasharray="${isOct ? 'none' : '1,3'}" />`);
    }
    for (let t = 0; t < Math.ceil(maxTime) + 1; t++) {
      const x = xForTime(t);
      staffLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${svgHeight}" stroke="#000" stroke-opacity="${o.gridOpacity! * 0.7}" stroke-width="0.4"/>`);
      if (t % 4 === 0) {
        staffLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${svgHeight}" stroke="#000" stroke-opacity="${o.gridOpacity! * 1.1}" stroke-width="0.7"/>`);
      }
    }
  }

  // Build note SVG elements
  const notesSVG: string[] = [];
  for (const r of rects) {
    const vel = r.velocity;
    let blurVal = Math.round((1 - vel) * 8);
    blurVal = Math.max(0, blurVal);
    const blurId = blurLevels.reduce((best, b) => Math.abs(b - blurVal) < Math.abs((best ?? 0) - blurVal) ? b : best, blurLevels[0]);

    const velBin = Math.floor(r.velocity * 4);
    const gKey = `${r.color}_${velBin}_${r.program}`;
    const gradientId = gradSet.get(gKey)?.id;

    const tailLength = Math.max(2, Math.min(200, Math.round(r.w * 0.6 + r.w * r.velocity * 0.4)));
    const tailX = r.x + r.w;
    const tailY = r.y;
    const tailH = r.h;

    const coreRect = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.color}" fill-opacity="${0.6 + r.velocity * 0.35}" rx="${r.h / 2}" ry="${r.h / 2}" />`;
    const glowRect = `<rect x="${r.x - r.h * 0.6}" y="${r.y - r.h * 0.6}" width="${r.w + r.h * 1.2}" height="${r.h + r.h * 1.2}" fill="${r.color}" fill-opacity="${0.18 + r.velocity * 0.22}" rx="${r.h}" ry="${r.h}" filter="url(#blur${blurId})"/>`;
    const tail = gradientId ? `<rect x="${tailX}" y="${tailY}" width="${tailLength}" height="${tailH}" fill="url(#${gradientId})" opacity="${0.95 - r.velocity * 0.2}" rx="${tailH / 2}" ry="${tailH / 2}" />` : '';

    notesSVG.push(`
      <g class="note" data-note="${r.noteId}" data-pitch="${r.start}" data-start="${r.start}" data-end="${r.end}" data-chan="${r.channel}">
        ${glowRect}
        ${tail}
        ${coreRect}
      </g>
    `);
  }

  const viewBox = `0 0 ${svgWidth} ${svgHeight}`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">
    ${defs}
    <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="${o.background}" />
    <g id="grid">${staffLines.join('\n')}</g>
    <g id="notes" style="mix-blend-mode:multiply; isolation:isolate;">
      ${notesSVG.join('\n')}
    </g>
    <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="none" stroke="#000" stroke-opacity="0.02"/>
  </svg>`;

  return svg;
}

// CLI 
if (require.main === module) {
  (async () => {
    const fs = await import('fs');
    const argv = process.argv.slice(2);
    if (argv.length < 2) {
      console.log('Usage: node midi-to-svg.js input.mid out.svg [pxPerSecond]');
      process.exit(1);
    }

    const [inPath, outPath] = argv as [string, string];
    const pxPerSecond = argv[2] ? Number(argv[2]) : undefined;
    const buf = fs.readFileSync(inPath);
    const svg = await renderMidiToSVG(buf.buffer, pxPerSecond ? { pxPerSecond } : undefined);
    fs.writeFileSync(outPath, svg);
    console.log('Wrote', outPath);
  })();
}
