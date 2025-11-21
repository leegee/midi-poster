#!/usr/bin/env bun
import fs from "node:fs";
import glob from "fast-glob";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { renderMidi, type RenderedMidi } from "./midi/midi-render";
import { createSvg, writeSvg } from "./midi/midi-row";
import { writePngFromSvg } from "./midi/png-from-svg.server";
import { Midi } from "@tonejs/midi";

export const TRACK_SKIP_RE = /^(http|by |Copyright|All Rights)/i;

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

async function renderSingleOrDouble(midiInstances: Midi[], argv: any, svgOutputPath: string, midiCount: number) {
  const double = argv.double ?? false;

  // Single or multiple MIDIs naturally stacked
  const renderedMidis: RenderedMidi[] = [];
  let xOffset = 0;

  const [globalMin, globalMax] = getGlobalPitchRange(midiInstances);

  for (const midi of midiInstances) {
    const options: any = {
      xOffset,
      pitchRange: [globalMin, globalMax],
      reverbIntensity: argv.reverb,
      softNotes: argv.softNotes,
      softNoteFactor: argv.softNoteFactor,
      noteHeightScaleFactor: argv.noteHeightScaleFactor,
      noteWidthScaleFactor: argv.noteWidthScaleFactor,
      velocityScaledHeight: argv.velocityScaledHeight,
      minNoteHeight: argv.minNoteHeight,
      densityScaleFactor: argv.densityScaleFactor,
      blur: argv.blur,
    };

    let rendered: RenderedMidi;

    if (!double) {
      rendered = renderMidi(midi, {
        ...options,
        width: midiCount === 1 ? argv.width : undefined,
        height: midiCount === 1 ? argv.height : undefined,
      });
    }

    else {
      // Double-layer: base layer
      const base = renderMidi(midi, { ...options, softNotes: true });
      // Top layer
      const top = renderMidi(midi, {
        ...options,
        width: midiCount === 1 ? argv.width : undefined,
        height: midiCount === 1 ? argv.height : undefined,
        softNotes: false,
        softNoteFactor: 1,
        noteHeightScaleFactor: argv.noteHeightScaleFactor * 0.5,
        noteWidthScaleFactor: argv.noteWidthScaleFactor * 0.5,
      });

      // Merge layers
      rendered = {
        width: Math.max(base.width, top.width),
        height: Math.max(base.height, top.height),
        rects: [...base.rects, ...top.rects],
        tracks: [...base.tracks, ...top.tracks],
        defs: [base.defs, top.defs].filter(Boolean).join("\n") || undefined,
      };
    }

    renderedMidis.push(rendered);
    xOffset += rendered.width;
  }

  // Compute total canvas size
  const totalWidth = renderedMidis.reduce((sum, r) => sum + r.width, 0);
  const totalHeight = Math.max(...renderedMidis.map(r => r.height));

  // Build final SVG row
  const { svg } = createSvg(renderedMidis, {
    background: argv.background,
    blur: argv.blur,
    softNotes: argv.softNotes,
    totalHeight,
    totalWidth,
  });

  await writeSvg(svg, svgOutputPath);
  await writePngFromSvg(svg, svgOutputPath, argv.width, argv.height);

  console.log(`Render complete: ${svgOutputPath}`);
}

// CLI
async function main() {
  const argv = yargs(hideBin(process.argv))
    .usage("Usage: $0 <out.svg> <input1.mid> [input2.mid ...] [options]")
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
  const midiPaths: string[] = (
    await Promise.all(
      midiPatterns.map(pattern => glob(pattern, { absolute: true }))
    )
  ).flat();

  if (!midiPaths.length) {
    console.error("No MIDI files found!");
    process.exit(1);
  }

  // Load MIDIs
  const midiInstances: Midi[] = [];
  for (const p of midiPaths) {
    try {
      console.log('Reading', p);
      const buf = fs.readFileSync(p);
      midiInstances.push(new Midi(buf));
    } catch (err) {
      console.warn(`Failed to load MIDI: ${p}`, err);
    }
  }

  if (!midiInstances.length) {
    console.error("No valid MIDI files loaded!");
    process.exit(1);
  }

  await renderSingleOrDouble(midiInstances, argv, svgOutputPath || "out.svg", midiInstances.length);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
