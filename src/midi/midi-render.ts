// midi-render.ts
import { type Midi } from "@tonejs/midi";
import { FAMILY_COLOR, trackNameToFamily } from "../colours";
import { DensityCell, DensityFeature } from "~/lib/density-feature";

export const TRACK_SKIP_RE = /^(http|by |Copyright|All Rights)/i;

const DENSITY_SCALE_FACTOR = 10;
const STAR_SCALE = 1.8;

export interface NoteRectRendered {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    velocity: number;
    rx?: number;
    ry?: number;
    shape?: "rect" | "star";
    starPoints?: string;
    filter?: string;
}

export interface TrackInfo {
    name: string;
    color: string;
}

export interface RenderedMidi {
    width: number;
    height: number;
    rects: NoteRectRendered[];
    tracks: TrackInfo[];
    defs?: string;
    blur?: number;
    density?: DensityCell[];
    densityMeta?: {
        timeStep: number;
        pitchStep: number;
        maxDensity: number;
    };
    features?: DensityFeature[];
}

export interface RenderOptions {
    xOffset?: number;
    pitchRange?: [number, number];
    width?: number;
    height?: number;
    totalWidth?: number;
    totalHeight?: number;
    targetWidth?: number;
    targetHeight?: number;
    reverbIntensity?: number;
    softNotes?: boolean;
    softNoteFactor?: number;
    noteHeightScaleFactor?: number;
    noteWidthScaleFactor?: number;
    minNoteHeight?: number;
    velocityScaledHeight?: boolean;
    blendMode?: string;
    densityScaleFactor?: number;
    densityTimeDivision?: number;
    blur?: number;
    double?: boolean;
    background?: string;
    topLayerNoBlur?: boolean;
    renderFeatures?: boolean;
}

function makeStarPoints(cx: number, cy: number, radius: number, spikes = 12): string {
    const step = (Math.PI * 2) / (spikes * 2);
    let path = "";
    for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? radius : radius / 2;
        const angle = i * step - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        path += `${x},${y} `;
    }
    return path.trim();
}

export function renderMidi(midi: Midi, options: RenderOptions = {}): RenderedMidi {
    const {
        width = 1000,
        height = 300,
        targetWidth = width,
        targetHeight = height,
        xOffset = 0,
        pitchRange = [0, 127],
        reverbIntensity = 1,
        softNotes = false,
        softNoteFactor = 3,
        noteHeightScaleFactor = 1,
        noteWidthScaleFactor = 1,
        minNoteHeight = 1.5,
        velocityScaledHeight = true,
        densityScaleFactor = DENSITY_SCALE_FACTOR,
        blur = 4,
        renderFeatures = true,
    } = options;

    const scaleX = targetWidth / width;
    const scaleY = targetHeight / height;

    const [minPitch, maxPitch] = pitchRange;
    const rects: NoteRectRendered[] = [];
    const tracks: TrackInfo[] = [];
    const midiDuration = midi.duration || 1;

    // Blur defs
    const blurFilters = (
        softNotes
            ? Array.from({ length: 5 }, (_, i) => {
                const v = (i + 1) / 5;
                const useBlur = (1 - v) * reverbIntensity * blur;
                return `<filter id="blur${i}" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="${useBlur}" />
                    </filter>`;
            }).join("\n")
            : ""
    )
        + `    <filter id="cloud-glow" x="-200%" y="-200%" width="500%" height="500%">
      <!-- base blur for glow -->
      <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="blur"/>
      <!-- optional color tint for the glow -->
      <feFlood flood-color="white" flood-opacity="0.6" result="color"/>
      <feComposite in="color" in2="blur" operator="in" result="coloredBlur"/>
      <!-- merge with original fill -->
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
`
        ;

    const defs = softNotes ? `<defs>\n${blurFilters}\n</defs>` : undefined;

    // Collect temporary rects for density
    const tempRects: { note: any; trackFamily: string; x: number; yBase: number; velScale: number; hBase: number; wBase: number }[] = [];

    for (const track of midi.tracks) {
        const trackName = track.name || track.instrument.name || "";
        if (trackName.match(TRACK_SKIP_RE)) continue;
        const familyKey = trackNameToFamily(trackName);
        const color = FAMILY_COLOR[familyKey] ?? FAMILY_COLOR.default ?? "#ffffff";

        console.log(`${trackName} ... ${color}`);

        tracks.push({ name: trackName, color });

        for (const note of track.notes) {
            const xBase = xOffset + (note.time / midiDuration) * width;
            const yBase = ((maxPitch - note.midi) / (maxPitch - minPitch)) * height;

            const durationW = (note.duration / midiDuration) * width;
            const scaledW = durationW * noteWidthScaleFactor;

            const velScale = velocityScaledHeight ? 0.5 + (note.velocity ?? 0) * 0.5 : 1;
            let h = 2 * noteHeightScaleFactor * velScale * (softNotes ? softNoteFactor : 1);
            if (h < minNoteHeight) h = minNoteHeight;

            // Centre around original x position
            const x = xBase - (scaledW - durationW) / 2;

            tempRects.push({
                note,
                trackFamily: familyKey,
                x,
                yBase,
                velScale,
                hBase: h,
                wBase: scaledW,
            });
        }
    }

    // Build density map
    // derive musical step duration
    // use tempo if available, otherwise approximate using total duration
    const tempo = midi.header.tempos?.[0]?.bpm ?? 120;
    const secondsPerBeat = 60 / tempo;
    const pitchStep = 1;

    // e.g. densityTimeDivision = 0.25 means one cell per 16th note
    const timeDivisionBeats = options.densityTimeDivision ?? 0.25;
    const timeStepDuration = secondsPerBeat * timeDivisionBeats;

    // convert that musical duration into pixels
    const timeStep = (timeStepDuration / midi.duration) * width;

    const densityMap = new Map<string, number>();

    for (const r of tempRects) {
        const start = Math.floor(r.x / timeStep);
        const end = Math.floor((r.x + r.wBase) / timeStep);
        const pitch = Math.floor(r.yBase / pitchStep);
        for (let t = start; t <= end; t++) {
            const key = `${t}:${pitch}`;
            densityMap.set(key, (densityMap.get(key) ?? 0) + 1);
        }
    }

    const maxDensity = Math.max(...densityMap.values(), 1);

    // Finalize rects with scaling applied
    for (const r of tempRects) {
        const start = Math.floor(r.x / timeStep);
        const end = Math.floor((r.x + r.wBase) / timeStep);
        const pitch = Math.floor(r.yBase / pitchStep);
        let localMax = 0;
        for (let t = start; t <= end; t++) {
            const key = `${t}:${pitch}`;
            localMax = Math.max(localMax, densityMap.get(key) ?? 0);
        }
        const density = localMax / maxDensity;

        const hFinal = r.hBase * (1 + densityScaleFactor * density);
        const shape: "rect" | "star" = ["cymbals"].includes(r.trackFamily) ? "star" : "rect";
        const wFinal = shape === "star" ? hFinal * STAR_SCALE : r.wBase;

        // Compute yFinal
        let yFinal: number;
        if (r.trackFamily === "timpani") {
            const timpaniNotes = tempRects.filter(t => t.trackFamily === "timpani");
            const minT = Math.min(...timpaniNotes.map(n => n.note.midi));
            const maxT = Math.max(...timpaniNotes.map(n => n.note.midi));
            const bottomRange = height * 0.2;
            yFinal = ((maxT - r.note.midi) / (maxT - minT)) * bottomRange + (height - bottomRange);
        } else if (shape === "star") {
            yFinal = height / 2 - hFinal / 2;
        } else {
            yFinal = r.yBase - hFinal / 2;
        }

        // Apply scaling
        const xScaled = r.x * scaleX;
        const yScaled = yFinal * scaleY;
        const wScaled = wFinal * scaleX;
        const hScaled = hFinal * scaleY;

        // Colouring
        const starPoints = shape === "star"
            ? makeStarPoints(xScaled + wScaled / 2, yScaled + hScaled / 2, hScaled / 2)
            : undefined;

        const blurIndex = softNotes ? Math.max(0, 4 - Math.floor((r.note.velocity ?? 0) * 5)) : 0;
        const filterId = softNotes ? `url(#blur${blurIndex})` : undefined;

        let color = FAMILY_COLOR[r.trackFamily] ?? FAMILY_COLOR.default ?? "#ffffff";
        if (color.startsWith("hsl")) {
            color = color.replace(/(\d+)%\)$/i, (match, l) => `${Math.min(100, +l + (100 - +l) * 0.3 * density)}% )`);
        } else if (color.startsWith("rgb")) {
            console.warn('Non-HSL/HSLa colour found');
            const rgbMatch = color.match(/\d+/g)?.map(Number) ?? [];
            const boosted = (v: number) => Math.min(255, Math.floor(v + (255 - v) * 0.3 * density));
            color = `rgb(${boosted(rgbMatch[0] || 0)},${boosted(rgbMatch[1] || 0)},${boosted(rgbMatch[2] || 0)})`;
        }

        rects.push({
            x: xScaled,
            y: yScaled,
            w: wScaled,
            h: hScaled,
            color,
            velocity: r.note.velocity ?? 0,
            rx: softNotes ? hScaled / 2 : 0,
            ry: softNotes ? hScaled / 2 : 0,
            shape,
            starPoints,
            filter: filterId,
        });
    }

    // Density map

    const density: DensityCell[] = [];

    for (const [key, value] of densityMap.entries()) {
        const [t, pitch] = key.split(":").map(Number);
        density.push({
            t,
            pitch,
            value,
            norm: value / maxDensity,
        });
    }

    return {
        width: targetWidth,
        height: targetHeight,
        rects,
        tracks,
        defs,
        density,
        densityMeta: { timeStep, pitchStep, maxDensity }
    };

}
