import { Midi } from "@tonejs/midi";

export interface NoteRectRendered {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    velocity: number;
    rx?: number;
    ry?: number;
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
    defs?: string; // for blur filters
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
    minNoteHeight?: number;         // CLI override for minimum note thickness
    velocityScaledHeight?: boolean; // scale height by velocity
    blendMode?: string;
}

function hashString(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h >>> 0;
}

function programToHue(program: number | null, trackName: string): number {
    const base = program !== null ? program * 17 : hashString(trackName);
    return base % 360;
}

export function renderMidi(
    midi: Midi,
    options: RenderOptions = {}
): RenderedMidi {
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
        blendMode = "normal", // <── new default
    } = options;

    const [minPitch, maxPitch] = pitchRange;
    const rects: NoteRectRendered[] = [];
    const tracks: TrackInfo[] = [];

    const midiDuration = midi.duration || 1;

    // Optional blur filter definition
    const defs = softNotes
        ? `<defs>
           <filter id="noteBlur" x="-10%" y="-10%" width="120%" height="120%">
             <feGaussianBlur in="SourceGraphic" stdDeviation="${reverbIntensity}" />
           </filter>
         </defs>`
        : undefined;

    for (const track of midi.tracks) {
        const program = track.instrument.number ?? null;
        const trackName = track.name || track.instrument.name || "";
        const hue = programToHue(program, trackName);
        const color = `hsl(${hue},70%,50%)`;

        tracks.push({ name: trackName, color });

        for (const note of track.notes) {
            const x = xOffset + (note.time / midiDuration) * width;
            const baseH = 2; // reference pixel height for one semitone row
            const yBase = ((maxPitch - note.midi) / (maxPitch - minPitch)) * height;

            const durationW = (note.duration / midiDuration) * width;

            // Velocity-responsive vertical scaling
            const velScale =
                velocityScaledHeight && note.velocity !== undefined
                    ? 0.5 + note.velocity * 0.5 // range 0.5–1.0
                    : 1;

            let h =
                baseH *
                noteScaleFactor *
                velScale *
                (softNotes ? softNoteFactor : 1);

            if (h < minNoteHeight) h = minNoteHeight;

            const y = yBase - h / 2; // center vertically

            rects.push({
                x,
                y,
                w: durationW,
                h,
                color,
                velocity: note.velocity ?? 0,
                rx: softNotes ? h / 2 : 0,
                ry: softNotes ? h / 2 : 0,
            });
        }
    }

    // Combine into SVG markup directly (optional, if CLI needs it)
    const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${defs ?? ""}
    <g style="mix-blend-mode: ${blendMode}; ${softNotes ? "filter: url(#noteBlur);" : ""}">
      ${rects
            .map(
                (r) =>
                    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.color}" rx="${r.rx ?? 0}" ry="${r.ry ?? 0}" />`
            )
            .join("\n")}
    </g>
  </svg>`;

    return { width, height, rects, tracks, defs: svg };
}
