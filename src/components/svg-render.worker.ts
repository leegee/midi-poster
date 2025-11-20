/// <reference lib="webworker" />

// @ts-ignore - Skypack URL import
import { Canvg, presets } from 'https://cdn.skypack.dev/canvg@^4.0.0';
// @ts-ignore
import { DOMParser } from 'https://cdn.skypack.dev/@xmldom/xmldom@0.7.5';

export interface RenderRequest {
    svg: string;
    width: number;
    height: number;
}

export interface RenderResponse {
    imageUrl: string | null;
}

const preset = presets.offscreen({ DOMParser });

self.onmessage = async (ev: MessageEvent<RenderRequest>) => {
    const svg = ev.data.svg;
    const width = Number(ev.data.width);
    const height = Number(ev.data.height);

    try {
        // OffscreenCanvas for worker
        const canvas = new OffscreenCanvas(width | 0, height | 0);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Cannot get 2D context');

        const v = await Canvg.from(ctx, svg, preset);

        await v.render();

        const blob = await canvas.convertToBlob({ type: 'image/png' });
        const imageUrl = URL.createObjectURL(blob);

        self.postMessage({ imageUrl } as RenderResponse);
    } catch (err) {
        console.error('Worker render failed:', err);
        self.postMessage({ imageUrl: null } as RenderResponse);
    }
};
