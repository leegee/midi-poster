import sharp from "sharp";
import fs from "node:fs";
import { type RenderedMidi, type NoteRectRendered } from "./midi-render";

export type RowOptions = {
    background?: string;
    showTrackNames?: boolean;
    trackNameHeight?: number;
    softNotes?: boolean;
    blur?: number;
    blendMode?: string;
};

export async function writeSvgAndPng(svg: string, svgOutPath: string, width = 2048, height = 780) {
    fs.writeFileSync(svgOutPath, svg);
    console.log("Wrote", svgOutPath);

    const pngOutputPath = svgOutPath.replace(/\.svg$/i, ".png");
    await sharp(Buffer.from(svg))
        .resize({ width, height })
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
        targetWidth?: number;
        targetHeight?: number;
        densityScale?: number;
    } = {}
): string {
    const { blendMode, background = "#FFF", targetWidth = 2048, targetHeight = 780 } = options;
    const fgBlend = blendMode ? `mix-blend-mode:${blendMode};` : "";

    const totalWidth = renderedMidis.reduce((acc, r) => acc + r.width, 0);
    const maxHeight = Math.max(...renderedMidis.map(r => r.height));
    const scaleX = targetWidth / totalWidth;
    const scaleY = targetHeight / maxHeight;

    const combinedDefs = renderedMidis.map(r => r.defs).filter(Boolean).join("\n");

    let content = "";
    let xOffset = 0;

    for (const midi of renderedMidis) {
        for (const rect of midi.rects) {
            const filter = rect.filter ? `filter="${rect.filter}"` : "";
            const newHeight = rect.h;
            const fillOpacity = Math.min(1, 0.9 - (1 - rect.velocity) * 0.5);

            if (rect.shape === "star" && rect.starPoints) {
                const scaledPoints = rect.starPoints
                    .split(" ")
                    .map(p => {
                        const [xStr, yStr] = p.split(",");
                        const x = Number(xStr ?? 0);
                        const y = Number(yStr ?? 0);
                        return `${x * scaleX},${y * scaleY}`;
                    })
                    .join(" ");
                content += `<polygon points="${scaledPoints}" fill="${rect.color}" fill-opacity="${fillOpacity}" ${filter} style="${fgBlend}"/>`;
            } else {
                content += `<rect 
    x="${(rect.x + xOffset) * scaleX}" 
    y="${(rect.y + rect.h / 2 - newHeight / 2) * scaleY}" 
    width="${rect.w * scaleX}" 
    height="${newHeight * scaleY}" 
    fill="${rect.color}" fill-opacity="${fillOpacity}" 
    ${filter} 
    rx="${(rect.rx ?? 0) * scaleX}" ry="${(rect.ry ?? 0) * scaleY}" 
    style="${fgBlend}"
/>`;
            }
        }
        xOffset += midi.width;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${targetWidth}" height="${targetHeight}" viewBox="0 0 ${targetWidth} ${targetHeight}">
  <rect width="100%" height="100%" fill="${background}" />
  ${combinedDefs}
  ${content}
</svg>`;
}
