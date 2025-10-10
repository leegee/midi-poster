import sharp from 'sharp';
import fs from 'node:fs';
import { type RenderedMidi, type NoteRectRendered, type TrackInfo } from './midi-render';

export type RowOptions = {
    background?: string;
    showTrackNames?: boolean;
    trackNameHeight?: number;
};

export function buildSvgRow(midis: RenderedMidi[], opts?: RowOptions): string {
    const background = opts?.background ?? '#fff';
    const showTrackNames = opts?.showTrackNames ?? true;
    const trackNameHeight = opts?.trackNameHeight ?? 20;

    let xOffset = 0;
    const noteElements: string[] = [];

    let totalWidth = 0;
    let maxHeight = 0;

    for (const midi of midis) {
        // Notes
        midi.rects.forEach((r: NoteRectRendered) => {
            noteElements.push(`
        <g transform="translate(${xOffset}, ${showTrackNames ? trackNameHeight : 0})">
          <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.color}" fill-opacity="${0.6 + r.velocity * 0.35}" rx="${r.h / 2}" ry="${r.h / 2}" />
        </g>
      `);
        });

        // Track names
        if (showTrackNames) {
            midi.tracks.forEach((t: TrackInfo) => {
                noteElements.push(`
          <text x="${xOffset + 5}" y="${trackNameHeight - 5}" fill="${t.color}" font-size="12" font-family="sans-serif">${t.name}</text>
        `);
            });
        }

        totalWidth += midi.width;
        maxHeight = Math.max(maxHeight, midi.height + (showTrackNames ? trackNameHeight : 0));
        xOffset += midi.width;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${maxHeight}" viewBox="0 0 ${totalWidth} ${maxHeight}" preserveAspectRatio="xMidYMid meet">
  <rect x="0" y="0" width="${totalWidth}" height="${maxHeight}" fill="${background}" />
  <g id="notes">${noteElements.join('\n')}</g>
</svg>`;
}

export async function writeSvgAndPng(svg: string, svgOutPath: string, width = 2048, height = 780) {
    fs.writeFileSync(svgOutPath, svg);
    console.log('Wrote', svgOutPath);

    const pngOutputPath = svgOutPath.replace(/\.svg$/i, '.png');
    await sharp(Buffer.from(svg))
        .resize({ width, height })
        .png()
        .toFile(pngOutputPath);
    console.log('Wrote', pngOutputPath);
}
