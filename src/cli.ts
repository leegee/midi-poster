#!/usr/bin/env bun
import fs from "node:fs";
import glob from "fast-glob";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { renderMidi, type RenderedMidi } from "./midi-render";
import { buildSvgRow, writeSvgAndPng } from "./midi-row";
import { Midi } from "@tonejs/midi";

async function main() {
  const argv = yargs(hideBin(process.argv))
    .usage("Usage: $0 <out.svg> <input1.mid> [input2.mid ...] [options]")
    .option("width", { type: "number", description: "Desired output width", default: 2048 })
    .option("height", { type: "number", description: "Desired output height", default: 800 })
    .option("reverb", { type: "number", description: "Reverb blur intensity", default: 1 })
    .option("soft-notes", { type: "boolean", description: "Render notes fatter and blurred", default: false })
    .option("soft-note-factor", { type: "number", description: "Multiplier for note height when softNotes is enabled", default: 3 })
    .option("blur", { type: "number", description: "Gaussian blur radius for soft notes", default: 2 })
    .option('blend-mode', { type: "string", description: 'SVG blend mode (multiply, screen, overlay, etc.)', default: 'normal' })
    .option('background', { type: "string", description: 'Sets a background', default: "#FFF" })
    .option('dark-mode', { type: "boolean", description: 'Sets a dark background', default: true })
    .option("velocity-scaled-height", {
      type: "boolean",
      description: "Scale note thickness by note velocity",
      default: true
    })
    .option("min-note-height", {
      type: "number",
      description: "Minimum visual height for a note (px)",
      default: 1.5
    })
    .option("note-scale-factor", {
      type: "number",
      description: "Vertical note height scale factor (fatter notes without blur)",
      default: 1,
    })
    .demandCommand(2, "You must provide an output SVG file and at least one MIDI file")
    .parseSync();

  const [svgOutputPath, ...midiPatterns] = argv._ as string[];

  // Expand globs (e.g. *.mid)
  const midiPaths: string[] = [];
  for (const pattern of midiPatterns) {
    midiPaths.push(...await glob(pattern));
  }

  if (midiPaths.length === 0) {
    console.error("No MIDI files found!");
    process.exit(1);
  }

  // Load and parse MIDI files
  const midiInstances: Midi[] = [];
  let globalMin = 127;
  let globalMax = 0;
  const TRACK_SKIP_RE = /^(http|by |Copyright|All Rights)/i;

  for (const p of midiPaths) {
    const buf = fs.readFileSync(p);
    const midi = new Midi(buf.buffer as any);
    midiInstances.push(midi);

    // Update global pitch range
    for (const track of midi.tracks) {
      if (track.name && track.name.match(TRACK_SKIP_RE)) continue;
      for (const note of track.notes) {
        globalMin = Math.min(globalMin, note.midi);
        globalMax = Math.max(globalMax, note.midi);
      }
    }
  }

  // Render each MIDI with same pitch range
  const renderedMidis: RenderedMidi[] = [];
  let xOffset = 0;

  for (const midi of midiInstances) {
    const rendered = renderMidi(midi, {
      xOffset,
      pitchRange: [globalMin - 2, globalMax + 2],
      width: argv.width,
      height: argv.height,
      reverbIntensity: argv.reverb,
      softNotes: argv.softNotes,
      softNoteFactor: argv.softNoteFactor,
      noteScaleFactor: argv.noteScaleFactor,
      velocityScaledHeight: argv.velocityScaledHeight,
      minNoteHeight: argv.minNoteHeight,
      blendMode: argv.blendMode,
      darkMode: argv.darkMode,
    });
    renderedMidis.push(rendered);
    xOffset += rendered.width;
  }

  const svg = buildSvgRow(renderedMidis, {
    softNotes: argv.softNotes,
    blur: argv.blur,
  });

  await writeSvgAndPng(svg, svgOutputPath || "out.svg", argv.width, argv.height);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
