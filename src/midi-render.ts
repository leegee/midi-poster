import { Midi } from "@tonejs/midi";
import { NAME_TO_FAMILY, FAMILY_COLOR } from "./colours";

// --- Rendered MIDI types ---
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

function makeStarPoints(cx: number, cy: number, radius: number, spikes = 5): string {
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

// --- Render MIDI ---
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
        blendMode
    } = options;

    const [minPitch, maxPitch] = pitchRange;

    const rects: NoteRectRendered[] = [];
    const tracks: TrackInfo[] = [];

    const midiDuration = midi.duration || 1;

    const defs = softNotes
        ? `<defs>
             <filter id="noteBlur" x="-10%" y="-10%" width="120%" height="120%">
               <feGaussianBlur in="SourceGraphic" stdDeviation="${reverbIntensity}" />
             </filter>
           </defs>`
        : undefined;

    for (const track of midi.tracks) {
        const trackName = track.name || track.instrument.name || "";
        const familyKey = trackNameToFamily(trackName);
        const color = FAMILY_COLOR[familyKey] ?? FAMILY_COLOR.default!;

        tracks.push({ name: trackName, color });

        for (const note of track.notes) {
            const x = xOffset + (note.time / midiDuration) * width;
            const baseH = 2;
            const yBase = ((maxPitch - note.midi) / (maxPitch - minPitch)) * height;
            const durationW = (note.duration / midiDuration) * width;

            const velScale =
                velocityScaledHeight && note.velocity !== undefined
                    ? 0.5 + note.velocity * 0.5
                    : 1;

            let h = baseH * noteScaleFactor * velScale * (softNotes ? softNoteFactor : 1);
            if (h < minNoteHeight) h = minNoteHeight;

            // Determine shape for percussion
            const isPercussion = ["timpani", "cymbals"].includes(familyKey);
            const shape: "rect" | "star" = isPercussion ? "star" : "rect";

            let wFinal = shape === "star" ? h * 2 : durationW;
            let hFinal = shape === "star" ? h * 2 : h;

            // Center percussion vertically
            const yFinal = shape === "star" ? height / 2 - hFinal / 2 : yBase - hFinal / 2;

            const starPoints = shape === "star" ? makeStarPoints(x + wFinal / 2, yFinal + hFinal / 2, hFinal / 2) : undefined;

            rects.push({
                x,
                y: yFinal,
                w: wFinal,
                h: hFinal,
                color,
                velocity: note.velocity ?? 0,
                rx: softNotes ? h / 2 : 0,
                ry: softNotes ? h / 2 : 0,
                shape,
                starPoints,
            });
        }
    }

    return { width, height, rects, tracks, defs };
}
