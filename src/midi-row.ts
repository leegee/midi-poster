import sharp from "sharp";
import fs from "node:fs";
import { type RenderedMidi, type NoteRectRendered, type TrackInfo } from "./midi-render";

export type RowOptions = {
    background?: string;
    showTrackNames?: boolean;
    trackNameHeight?: number;
    softNotes?: boolean;
    blur?: number;
    blendMode?: string;
};

export function buildSvgRow(midis: RenderedMidi[], opts?: RowOptions): string {
    const background = opts?.background ?? "#fff";
    const showTrackNames = opts?.showTrackNames ?? true;
    const trackNameHeight = opts?.trackNameHeight ?? 20;

    let xOffset = 0;
    const noteElements: string[] = [];
    const allDefs = new Map<string, string>();

    let totalWidth = 0;
    let maxHeight = 0;

    for (const midi of midis) {
        if (midi.defs) {
            midi.defs.replace(/<defs>([\s\S]*?)<\/defs>/g, (_: string, inner: string) => {
                inner.split(/\n/).forEach((d: string) => {
                    if (d.trim()) allDefs.set(d.trim(), d.trim());
                });
                return "";
            });
        }

        midi.rects.forEach((r: NoteRectRendered) => {
            const blurFilter = opts?.softNotes ? "filter='url(#noteBlur)'" : "";

            if (r.shape === "star" && r.starPoints) {
                // noteElements.push(`
                //     <polygon points="${r.starPoints}" fill="${r.color}" fill-opacity="${0.6 + r.velocity * 0.35}" />
                // `);
            } else {
                noteElements.push(`
                    <g transform="translate(${xOffset}, ${showTrackNames ? trackNameHeight : 0})">
                      <rect
                        x="${r.x}"
                        y="${r.y}"
                        width="${r.w}"
                        height="${r.h}"
                        fill="${r.color}"
                        fill-opacity="${0.6 + r.velocity * 0.35}"
                        rx="${r.rx ?? r.h / 2}"
                        ry="${r.ry ?? r.h / 2}"
                        ${blurFilter}
                      />
                    </g>
                `);
            }
        });


        if (showTrackNames) {
            midi.tracks.forEach((t: TrackInfo) => {
                console.info(`Track ${t.name} ... ${t.color}`);
            });
        }

        totalWidth += midi.width;
        maxHeight = Math.max(maxHeight, midi.height + (showTrackNames ? trackNameHeight : 0));
        xOffset += midi.width;
    }

    const defsString = `<defs>${[...allDefs.values()].join("\n")}</defs>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${maxHeight}"
     viewBox="0 0 ${totalWidth} ${maxHeight}" preserveAspectRatio="xMidYMid meet">
  ${defsString}
  <rect x="0" y="0" width="${totalWidth}" height="${maxHeight}" fill="${background}" />
  <g id="notes">${noteElements.join("\n")}</g>
</svg>`;
}

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
