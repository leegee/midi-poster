import fs from "node:fs";
import { RenderOptions, type RenderedMidi } from "./midi-render";
import { renderDensityFeatures } from "~/lib/density-feature";

export async function writeSvg(
    svg: string,
    svgOutPath: string,
) {
    fs.writeFileSync(svgOutPath, svg);
    console.log(new Date().toLocaleTimeString(), "Wrote", svgOutPath);
}

export function createSvg(
    renderedMidis: RenderedMidi[],
    options: RenderOptions = {}
) {
    const { blendMode, background = "#FFF", topLayerNoBlur = false } = options;
    const fgBlend = blendMode ? `mix-blend-mode:${blendMode};` : "";

    const totalMidiWidth = renderedMidis.reduce((acc, r) => acc + r.width, 0);
    const totalHeight = Math.max(...renderedMidis.map(r => r.height));

    const combinedDefs = renderedMidis
        .map(r => (!topLayerNoBlur ? r.defs : undefined))
        .filter(Boolean)
        .join("\n");

    let content = "";
    let featureOverlay = "";
    let xOffset = 0;

    for (const midi of renderedMidis) {
        for (const rect of midi.rects) {
            const filter = topLayerNoBlur ? "" : rect.filter ? `filter="${rect.filter}"` : "";
            if (rect.shape === "star" && rect.starPoints) {
                content += `<polygon points="${rect.starPoints}" fill="${rect.color}" fill-opacity="1" ${filter} style="${fgBlend}"/>`;
            } else {
                content += `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="${rect.color}" ${filter} rx="${rect.rx ?? 0}" ry="${rect.ry ?? 0}" style="${fgBlend}"/> `;
            }
        }

        console.log('xxx', midi, midi.features?.length, options.renderFeatures)
        if (midi.features?.length && options.renderFeatures) {
            featureOverlay += renderDensityFeatures(midi.features, midi.width, midi.height);
        }

        xOffset += midi.width;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" 
      width="${totalMidiWidth}" 
      height="${totalHeight}" 
      viewBox="0 0 ${totalMidiWidth} ${totalHeight}">
      <rect width="100%" height="100%" fill="${background}" />
      ${combinedDefs}
      ${content}
      ${featureOverlay}
    </svg>`;

    return {
        totalMidiWidth,
        totalHeight,
        svg
    };
}




