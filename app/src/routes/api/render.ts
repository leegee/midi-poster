import { renderMidi } from "~/midi/midi-render";
import { buildSvgRow } from "~/midi/midi-row";
import sharp from "sharp";

export async function POST({ request }: { request: Request }) {
    const { midiArrayBuffer, args } = await request.json();

    // Convert base64 string back to ArrayBuffer
    const buf = Buffer.from(midiArrayBuffer, "base64");
    const { Midi } = await import("@tonejs/midi");
    const midi = new Midi(buf);

    const rendered = renderMidi(midi, args);
    const svgStr = buildSvgRow([rendered], args).svg;

    const pngBuffer = await sharp(Buffer.from(svgStr))
        .png()
        .toBuffer();

    return new Response(pngBuffer, {
        headers: {
            "Content-Type": "image/png",
            "Content-Disposition": "inline; filename=render.png",
        },
    });
}
