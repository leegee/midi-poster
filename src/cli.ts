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
    .option("width", { type: "number", description: "Desired output width", default: 1024 })
    .option("height", { type: "number", description: "Desired output height", default: 200 })
    .option("reverb", { type: "number", description: "Reverb blur intensity", default: 1 })
    .demandCommand(2, "You must provide an output SVG file and at least one MIDI file")
    .parseSync();

  const [svgOutputPath, ...midiPatterns] = argv._ as string[];

  // Expand globs
  const midiPaths: string[] = [];
  for (const pattern of midiPatterns) {
    midiPaths.push(...await glob(pattern));
  }

  if (midiPaths.length === 0) {
    console.error("No MIDI files found! Did you need to \\escape brackets or other special chars?");
    process.exit(1);
  }

  // Load MIDI files and compute global pitch range
  let globalMin = 127;
  let globalMax = 0;
  const midiInstances: Midi[] = [];

  for (const p of midiPaths) {
    const buf = fs.readFileSync(p);
    const midi = new Midi(buf);
    midiInstances.push(midi);

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

  for (const midi of midiInstances) {
    const rendered = renderMidi(midi, {
      xOffset,
      pitchRange: [globalMin - 2, globalMax + 2],
      width: argv.width,
      height: argv.height,
      reverbIntensity: argv.reverb,
    });
    renderedMidis.push(rendered);
    xOffset += rendered.width;
  }

  const svg = buildSvgRow(renderedMidis);
  await writeSvgAndPng(svg, (svgOutputPath || "out.svg"), argv.width, argv.height);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
