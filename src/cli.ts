#!/usr/bin/env bun
import glob from 'fast-glob';
import fs from 'node:fs';
import { renderMidi, type RenderedMidi } from './midi-render';
import { buildSvgRow, writeSvgAndPng } from './midi-row';

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    console.log('Usage: cli.ts out.svg input1.mid [input2.mid ...]');
    process.exit(1);
  }

  const svgOutputPath = argv[0] || "out.svg";
  const midiGlobPatterns = argv.slice(1);

  // Expand globs
  const midiPaths: string[] = [];
  for (const pattern of midiGlobPatterns) {
    midiPaths.push(...await glob(pattern));
  }

  if (midiPaths.length === 0) {
    console.error('No MIDI files found!');
    process.exit(1);
  }

  // Compute global pitch range across all MIDIs
  let globalMin = 127;
  let globalMax = 0;
  const midiBuffers: ArrayBuffer[] = [];

  for (const p of midiPaths) {
    const buf = fs.readFileSync(p);
    midiBuffers.push(buf.buffer);

    const midiMod = await import('@tonejs/midi');
    const midi = new midiMod.Midi(buf.buffer as any);
    for (const track of midi.tracks) {
      for (const note of track.notes) {
        globalMin = Math.min(globalMin, note.midi);
        globalMax = Math.max(globalMax, note.midi);
      }
    }
  }

  // Render each MIDI with same pitch range
  const renderedMidis: RenderedMidi[] = [];
  let xOffset = 0;
  for (const buf of midiBuffers) {
    const rendered = renderMidi(buf, { xOffset, pitchRange: [globalMin - 2, globalMax + 2] });
    renderedMidis.push(rendered);
    xOffset += rendered.width;
  }

  const svg = buildSvgRow(renderedMidis);
  await writeSvgAndPng(svg, svgOutputPath);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
