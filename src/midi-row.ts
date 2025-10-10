import sharp from "sharp";
import fs from "node:fs";
import { type RenderedMidi } from "./midi-render";

export async function writeSvgAndPng(svg: string, svgOutPath: string, width: number, height: number) {
    fs.writeFileSync(svgOutPath, svg);
    console.log(new Date().toLocaleTimeString(), "Wrote", svgOutPath);

    const pngOutputPath = svgOutPath.replace(/\.svg$/i, ".png");
    await sharp(Buffer.from(svg))
        .resize({ width, height })
        .png()
        .toFile(pngOutputPath);
    console.log(new Date().toLocaleTimeString(), "Wrote", pngOutputPath);
}

export function buildSvgRow(
    renderedMidis: RenderedMidi[],
    options: {
        softNotes?: boolean;
        blur?: number;
        noteScaleFactor?: number;
        blendMode?: string;
        background?: string;
        targetWidth?: number;
        targetHeight?: number;
        topLayerNoBlur?: boolean;
    } = {}
) {
    const { blendMode, background = "#FFF", targetWidth = 2048, targetHeight = 780, topLayerNoBlur = false } = options;
    const fgBlend = blendMode ? `mix-blend-mode:${blendMode};` : "";

    const totalMidiWidth = renderedMidis.reduce((acc, r) => acc + r.width, 0);
    const totalHeight = Math.max(...renderedMidis.map(r => r.height));

    // Combine defs
    const combinedDefs = renderedMidis
        .map(r => (!topLayerNoBlur ? r.defs : undefined))
        .filter(Boolean)
        .join("\n");

    let content = "";
    let xOffset = 0;

    for (const midi of renderedMidis) {
        for (const rect of midi.rects) {
            const filter = topLayerNoBlur ? "" : rect.filter ? `filter="${rect.filter}"` : "";
            if (rect.shape === "star" && rect.starPoints) {
                content += `<polygon points="${rect.starPoints}" fill="${rect.color}" fill-opacity="1" ${filter} style="${fgBlend}"/>`;
            } else {
                content += `<rect 
  x="${rect.x}" 
  y="${rect.y}" 
  width="${rect.w}" 
  height="${rect.h}" 
  fill="${rect.color}" 
  ${filter} 
  rx="${rect.rx ?? 0}" ry="${rect.ry ?? 0}" 
  style="${fgBlend}"
/>`;
            }
        }
        xOffset += midi.width;
    }

    return {
        totalMidiWidth: targetWidth,
        totalHeight: targetHeight,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" 
  width="${targetWidth}" 
  height="${targetHeight}" 
  viewBox="0 0 ${totalMidiWidth} ${totalHeight}">
  <rect width="100%" height="100%" fill="${background}" />
  ${combinedDefs}
  ${content}
</svg>`
    };
}
