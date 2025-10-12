// midi-render-server.ts
import sharp from "sharp";
import fs from "node:fs";

export async function writeSvgAndPng(svg: string, outPath: string, width?: number, height?: number) {
    const pngBuffer = await sharp(Buffer.from(svg))
        .resize(width, height)
        .png()
        .toBuffer();
    await fs.promises.writeFile(outPath, pngBuffer);
}
