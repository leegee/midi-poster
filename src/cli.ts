#!/usr/bin/env bun
import fs from "node:fs";
import glob from "fast-glob";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { renderMidi, type RenderedMidi } from "./midi-render";
import { buildSvgRow, writeSvgAndPng } from "./midi-row";
import { Midi } from "@tonejs/midi";

const TRACK_SKIP_RE = /^(http|by |Copyright|All Rights)/i;

async function renderSingleOrDouble(midiInstances: Midi[], argv: any, svgOutputPath: string) {
  const double = argv.double ?? false;
  const width = argv.width;
  const height = argv.height;

  if (!double) {
    await renderFinal(midiInstances, argv, svgOutputPath, {
      softNotes: argv.softNotes,
      softNoteFactor: argv.softNoteFactor,
      noteScaleFactor: argv.noteScaleFactor,
    });
    return;
  }

  // Double-layer render

  // Layer 1: soft/blurred/larger
  const baseLayer: RenderedMidi[] = midiInstances.map(midi =>
    renderMidi(midi, {
      xOffset: 0,
      pitchRange: getGlobalPitchRange(midiInstances),
      width,
      height,
      targetWidth: width,
      targetHeight: height,
      reverbIntensity: argv.reverb,
      softNotes: true,
      softNoteFactor: argv.softNoteFactor,
      noteScaleFactor: argv.noteScaleFactor,
      velocityScaledHeight: argv.velocityScaledHeight,
      minNoteHeight: argv.minNoteHeight,
      blendMode: argv.blendMode,
      densityScaleFactor: argv.densityScaleFactor,
      blur: argv.blur,
    })
  );

  // Layer 2: crisp/no blur
  const topLayer: RenderedMidi[] = midiInstances.map(midi =>
    renderMidi(midi, {
      xOffset: 0,
      pitchRange: getGlobalPitchRange(midiInstances),
      width,
      height,
      targetWidth: width,
      targetHeight: height,
      reverbIntensity: argv.reverb,
      softNotes: false,
      softNoteFactor: 1,
      noteScaleFactor: argv.noteScaleFactor * 0.5,
      velocityScaledHeight: argv.velocityScaledHeight,
      minNoteHeight: argv.minNoteHeight,
      blendMode: argv.blendMode,
      densityScaleFactor: argv.densityScaleFactor,
    })
  );

  // Combine rects from both layers
  const combined: RenderedMidi = {
    width,
    height,
    blur: argv.blur,
    rects: [...baseLayer.flatMap(r => r.rects), ...topLayer.flatMap(r => r.rects)],
    tracks: [...baseLayer.flatMap(r => r.tracks), ...topLayer.flatMap(r => r.tracks)],
    defs: baseLayer.map(r => r.defs).filter(Boolean).join("\n") || undefined,
  };

  const { svg, totalMidiWidth, totalHeight } = buildSvgRow([combined], {
    softNotes: true,
    blur: argv.blur,
    background: argv.background,
    blendMode: argv.blendMode,
    topLayerNoBlur: true,
  });

  await writeSvgAndPng(svg, svgOutputPath, totalMidiWidth, totalHeight);
  console.log(`Double-layer superimposed render complete.`);
}

function getGlobalPitchRange(midiInstances: Midi[]): [number, number] {
  let globalMin = 127;
  let globalMax = 0;
  for (const midi of midiInstances) {
    for (const track of midi.tracks) {
      if (track.name && track.name.match(TRACK_SKIP_RE)) continue;
      for (const note of track.notes) {
        globalMin = Math.min(globalMin, note.midi);
        globalMax = Math.max(globalMax, note.midi);
      }
    }
  }
  return [globalMin - 2, globalMax + 2];
}

async function renderFinal(
  midiInstances: Midi[],
  argv: any,
  outputPath: string,
  opts: { softNotes: boolean; softNoteFactor: number; noteScaleFactor: number }
) {
  let xOffset = 0;
  const renderedMidis: RenderedMidi[] = [];

  const [globalMin, globalMax] = getGlobalPitchRange(midiInstances);

  for (const midi of midiInstances) {
    const rendered = renderMidi(midi, {
      xOffset,
      pitchRange: [globalMin, globalMax],
      width: argv.width,
      height: argv.height,
      targetWidth: argv.width,
      targetHeight: argv.height,
      reverbIntensity: argv.reverb,
      softNotes: opts.softNotes,
      softNoteFactor: opts.softNoteFactor,
      noteScaleFactor: opts.noteScaleFactor,
      velocityScaledHeight: argv.velocityScaledHeight,
      minNoteHeight: argv.minNoteHeight,
      blendMode: argv.blendMode,
      densityScaleFactor: argv.densityScaleFactor,
      blur: argv.blur,
    });
    renderedMidis.push(rendered);
    xOffset += rendered.width;
  }

  const { svg, totalMidiWidth, totalHeight } = buildSvgRow(renderedMidis, {
    softNotes: opts.softNotes,
    blur: argv.blur,
    background: argv.background,
    blendMode: argv.blendMode,
  });

  await writeSvgAndPng(svg, outputPath, totalMidiWidth, totalHeight);
}

// Main CLI
async function main() {
  const argv = yargs(hideBin(process.argv))
    .usage("Usage: $0 <out.svg> <input1.mid> [input2.mid ...] [options]")
    .option("width", { type: "number", default: 2048 })
    .option("height", { type: "number", default: 800 })
    .option("reverb", { type: "number", default: 1 })
    .option("soft-notes", { type: "boolean", default: false })
    .option("soft-note-factor", { type: "number", default: 3 })
    .option("blur", { type: "number", default: 2 })
    .option("blend-mode", { type: "string", default: "normal" })
    .option("background", { type: "string", default: "#FFF" })
    .option("density-scale-factor", { type: "number", default: 2 })
    .option("velocity-scaled-height", { type: "boolean", default: true })
    .option("min-note-height", { type: "number", default: 1.5 })
    .option("note-scale-factor", { type: "number", default: 1 })
    .option("double", { type: "boolean", description: "Render double layers", default: false })
    .demandCommand(2, "You must provide an output SVG file and at least one MIDI file")
    .parseSync();

  const [svgOutputPath, ...midiPatterns] = argv._ as string[];

  // Expand globs
  const midiPaths: string[] = [];
  for (const pattern of midiPatterns) {
    midiPaths.push(...(await glob(pattern)));
  }

  if (!midiPaths.length) {
    console.error("No MIDI files found!");
    process.exit(1);
  }

  // Load MIDI
  const midiInstances: Midi[] = midiPaths.map(p => {
    const buf = fs.readFileSync(p);
    return new Midi(buf.buffer as any);
  });

  await renderSingleOrDouble(midiInstances, argv, svgOutputPath || "out.svg");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
