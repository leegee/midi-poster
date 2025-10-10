import sharp from 'sharp';
import { type RenderedMidi, type RenderedRect } from './midi-render';
import fs from 'node:fs';

export type RowOptions = {
    background?: string;
};

export function buildSvgRow(midis: RenderedMidi[], opts?: RowOptions): string {
    const background = opts?.background ?? '#fff';
    let xOffset = 0;
    const allDefs = new Map<string, string>();
    const noteElements: string[] = [];

    let totalWidth = 0;
    let maxHeight = 0;

    for (const midi of midis) {
        if (midi.defs) {
            midi.defs.replace(/<filter.*?>.*?<\/filter>/gs, match => {
                allDefs.set(match, match);
                return '';
            });
        }

        midi.rects.forEach(r => {
            noteElements.push(`<g transform="translate(${xOffset},0)">
        <rect x="${r.x - xOffset}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.color}" fill-opacity="${0.6 + r.velocity * 0.35}" rx="${r.h / 2}" ry="${r.h / 2}" />
      </g>`);
        });

        totalWidth += midi.width;
        maxHeight = Math.max(maxHeight, midi.height);
        xOffset += midi.width;
    }

    const defsString = `<defs>${[...allDefs.values()].join('\n')}</defs>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${maxHeight}" viewBox="0 0 ${totalWidth} ${maxHeight}" preserveAspectRatio="xMidYMid meet">
  ${defsString}
  <rect x="0" y="0" width="${totalWidth}" height="${maxHeight}" fill="${background}" />
  <g id="notes">${noteElements.join('\n')}</g>
</svg>`;
}

export async function writeSvgAndPng(svg: string, svgOutPath: string) {
    fs.writeFileSync(svgOutPath, svg);
    console.log('Wrote', svgOutPath);

    const pngOutputPath = svgOutPath.replace(/\.svg$/i, '.png');
    await sharp(Buffer.from(svg))
        .png()
        .toFile(pngOutputPath);
    console.log('Wrote', pngOutputPath);
}
