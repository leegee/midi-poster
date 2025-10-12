import sharp from "sharp";
import { Midi } from "@tonejs/midi";
import { renderMidi } from "./midi-render";
import { buildSvgRow } from "./midi-row";

export async function POST(midiFilesBase64: string[], options: any) {
    const midiBuffers = midiFilesBase64.map(b => Buffer.from(b, "base64"));
    const midis = midiBuffers.map(buf => new Midi(buf));

    const rendered = renderMidi(midis[0], options);
    const { svg } = buildSvgRow([rendered], options);

    return await sharp(Buffer.from(svg))
        .png()
        .toBuffer();
}
