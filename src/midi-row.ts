import sharp from "sharp";
import fs from "node:fs";
import { type RenderedMidi, type NoteRectRendered, type TrackInfo } from "./midi-render";

export type RowOptions = {
    background?: string;
    showTrackNames?: boolean;
    trackNameHeight?: number; // space for track labels
    softNotes?: boolean;
    blur?: number;
    blendMode?: string; // e.g., 'multiply', 'screen'
};

export async function writeSvgAndPng(svg: string, svgOutPath: string, width = 2048, height = 780) {
    fs.writeFileSync(svgOutPath, svg);
    console.log("Wrote", svgOutPath);

    const pngOutputPath = svgOutPath.replace(/\.svg$/i, ".png");
    await sharp(Buffer.from(svg))
        .resize({ width })
        .png()
        .toFile(pngOutputPath);
    console.log("Wrote", pngOutputPath);
}

export function buildSvgRow(
    renderedMidis: RenderedMidi[],
    options: {
        softNotes?: boolean;
        blur?: number;
        noteScaleFactor?: number;
        blendMode?: string;
        background?: string;
    } = {}
): string {
    const { blendMode, background = "#FFF" } = options;

    const bgColor = background ?? "white";
    const fgBlend = blendMode ? `mix-blend-mode:${blendMode};` : "";

    // SVG header setup
    const totalWidth = renderedMidis.reduce((acc, r) => acc + r.width, 0);
    const maxHeight = Math.max(...renderedMidis.map(r => r.height));

    // Combine all <defs> blocks into one
    const combinedDefs = renderedMidis
        .map(r => r.defs)
        .filter(Boolean)
        .join("\n");

    // Draw all note shapes
    let content = "";
    let xOffset = 0;
    for (const midi of renderedMidis) {
        for (const rect of midi.rects) {
            const filter = rect.filter ? `filter="${rect.filter}"` : "";
            const fillOpacity = 0.9 - (1 - rect.velocity) * 0.5; // softer = more transparent

            if (rect.shape === "star" && rect.starPoints) {
                content += `<polygon points="${rect.starPoints}" fill="${rect.color}" fill-opacity="${fillOpacity}" ${filter} style="${fgBlend}"/>`;
            } else {
                content += `<rect x="${rect.x + xOffset}" y="${rect.y}" width="${rect.w}" height="${rect.h}"
                    fill="${rect.color}" fill-opacity="${fillOpacity}" ${filter} rx="${rect.rx ?? 0}" ry="${rect.ry ?? 0}"
                    style="${fgBlend}"/>`;
            }
        }
        xOffset += midi.width;
    }

    // Assemble SVG
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${maxHeight}" viewBox="0 0 ${totalWidth} ${maxHeight}">
  <rect width="100%" height="100%" fill="${bgColor}" />
  ${combinedDefs ? combinedDefs : ""}
  ${content}
</svg>`;
}
