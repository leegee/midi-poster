import { Midi } from "@tonejs/midi";
import { NAME_TO_FAMILY, FAMILY_COLOR } from "./colours";

const DENSITY_SCALE_FACTOR = 4;
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
    starPoints?: string; // SVG polygon points if shape === "star"
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
}

export interface RenderOptions {
    xOffset?: number;
    pitchRange?: [number, number];
    width?: number;
    height?: number;
    reverbIntensity?: number;
    softNotes?: boolean;
    softNoteFactor?: number;
    noteScaleFactor?: number;
    minNoteHeight?: number;
    velocityScaledHeight?: boolean;
    blendMode?: string; // e.g., 'multiply', 'screen'
}

function trackNameToFamily(name: string): string {
    for (const [regex, family] of NAME_TO_FAMILY) {
        if (regex.test(name)) return family;
    }
    return "default";
}

function makeStarPoints(cx: number, cy: number, radius: number, spikes = 15): string {
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
        xOffset = 0,
        pitchRange = [0, 127],
        width = 1000,
        height = 300,
        reverbIntensity = 1,
        softNotes = false,
        softNoteFactor = 3,
        noteScaleFactor = 1,
        minNoteHeight = 1.5,
        velocityScaledHeight = true,
    } = options;

    const [minPitch, maxPitch] = pitchRange;
    const rects: NoteRectRendered[] = [];
    const tracks: TrackInfo[] = [];
    const midiDuration = midi.duration || 1;

    // --- Blur filters ---
    const blurFilters = softNotes
        ? Array.from({ length: 5 }, (_, i) => {
            const v = (i + 1) / 5;
            const blur = (1 - v) * reverbIntensity * 3;
            return `<filter id="blur${i}" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" />
                    </filter>`;
        }).join("\n")
        : "";
    const defs = softNotes ? `<defs>\n${blurFilters}\n</defs>` : undefined;

    // --- Render notes ---
    for (const track of midi.tracks) {
        const trackName = track.name || track.instrument.name || "";
        const familyKey = trackNameToFamily(trackName);
        const colorHex = FAMILY_COLOR[familyKey] ?? FAMILY_COLOR.default ?? "#ffffff";
        const safeHex = colorHex.replace(/^#/, "").padEnd(6, "0"); // ensure 6 digits
        const baseR = parseInt(safeHex.slice(0, 2), 16) || 255;
        const baseG = parseInt(safeHex.slice(2, 4), 16) || 255;
        const baseB = parseInt(safeHex.slice(4, 6), 16) || 255;

        tracks.push({ name: trackName, color: colorHex });

        for (const note of track.notes) {
            const x = xOffset + (note.time / midiDuration) * width;
            const yBase = ((maxPitch - note.midi) / (maxPitch - minPitch)) * height;
            const durationW = (note.duration / midiDuration) * width;

            const velScale = velocityScaledHeight ? 0.5 + (note.velocity ?? 0) * 0.5 : 1;
            let h = 2 * noteScaleFactor * velScale * (softNotes ? softNoteFactor : 1);
            if (h < minNoteHeight) h = minNoteHeight;

            const isPercussion = ["timpani", "cymbals"].includes(familyKey);
            const shape: "rect" | "star" = isPercussion ? "star" : "rect";

            const wFinal = shape === "star" ? h * 2 : durationW;
            const hFinal = shape === "star" ? h * 2 : h;
            const yFinal = shape === "star" ? height / 2 - hFinal / 2 : yBase - hFinal / 2;

            const starPoints = shape === "star"
                ? makeStarPoints(x + wFinal / 2, yFinal + hFinal / 2, hFinal / 2)
                : undefined;

            const blurIndex = softNotes ? Math.max(0, 4 - Math.floor((note.velocity ?? 0) * 5)) : 0;
            const filterId = softNotes ? `url(#blur${blurIndex})` : undefined;

            // --- Use FAMILY_COLOR directly ---
            rects.push({
                x, y: yFinal, w: wFinal, h: hFinal,
                color: FAMILY_COLOR[familyKey] ?? FAMILY_COLOR.default ?? "#ffffff",
                velocity: note.velocity ?? 0,
                rx: softNotes ? h / 2 : 0,
                ry: softNotes ? h / 2 : 0,
                shape, starPoints, filter: filterId,
            });
        }

    }

    // --- Density-based enhancement ---
    const timeStep = width / 2000;
    const pitchStep = 1;
    const densityMap = new Map<string, number>();

    for (const rect of rects) {
        const start = Math.floor(rect.x / timeStep);
        const end = Math.floor((rect.x + rect.w) / timeStep);
        const pitch = Math.floor(rect.y / pitchStep);
        for (let t = start; t <= end; t++) {
            const key = `${t}:${pitch}`;
            densityMap.set(key, (densityMap.get(key) ?? 0) + 1);
        }
    }

    const maxDensity = Math.max(...densityMap.values(), 1);

    for (const rect of rects) {
        const start = Math.floor(rect.x / timeStep);
        const end = Math.floor((rect.x + rect.w) / timeStep);
        const pitch = Math.floor(rect.y / pitchStep);

        let localMax = 0;
        for (let t = start; t <= end; t++) {
            const key = `${t}:${pitch}`;
            localMax = Math.max(localMax, densityMap.get(key) ?? 0);
        }

        const density = localMax / maxDensity;
        rect.h *= 1 + DENSITY_SCALE_FACTOR * density;

        // Boost brightness by increasing luminosity (for HSL) or opacity
        // Assume rect.color is a valid CSS string, e.g., "hsl(...)" or "hsla(...)"
        if (rect.color.startsWith("hsl")) {
            // Increase lightness by up to 30% of remaining headroom
            rect.color = rect.color.replace(
                /(\d+)%\)$/i,
                (match, l) => `${Math.min(100, +l + (100 - +l) * 0.3 * density)}% )`
            );
        } else if (rect.color.startsWith("rgb")) {
            // parse numbers and boost towards 255
            const rgbMatch = rect.color.match(/\d+/g)?.map(Number) ?? [];
            const r = rgbMatch[0] ?? 255;
            const g = rgbMatch[1] ?? 255;
            const b = rgbMatch[2] ?? 255;

            const boosted = (v: number) => Math.min(255, Math.floor(v + (255 - v) * 0.3 * density));
            rect.color = `rgb(${boosted(r)},${boosted(g)},${boosted(b)})`;
        }
    }

    return { width, height, rects, tracks, defs };
}
