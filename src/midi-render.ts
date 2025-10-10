import { Midi } from "@tonejs/midi";

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

// --- Family parsing ---
const NAME_TO_FAMILY: [RegExp, string][] = [
    [/^(flauti|flute)/i, "flute"],
    [/^(oboi|oboe)/i, "oboe"],
    [/^(clarinetti|clarinet)/i, "clarinet"],
    [/^(fagotti|bassoon)/i, "bassoon"],
    [/^(corni|horn)/i, "horn"],
    [/^(trombe|trumpet)/i, "trumpet"],
    [/^(timpani|percussion)/i, "timpani"],
    [/^(violini|violin)/i, "violin"],
    [/^(viole|viola)/i, "viola"],
    [/^(violoncelli|violoncello|cello)/i, "cello"],
    [/^(contrabassi|double bass)/i, "bass"],
    [/^(pizzicato strings)/i, "pizzicato"],
    [/^(synthstrings 1|synth|pad)/i, "synth"],
    [/^(acoustic grand piano|piano)/i, "piano"],
];

const FAMILY_COLOR: Record<string, string> = {
    // Woodwinds (cool, airy)
    flute: "hsl(200,60%,60%)",  // sky blue
    oboe: "hsl(210,60%,55%)",  // steel blue
    clarinet: "hsl(180,60%,55%)",  // teal
    bassoon: "hsl(190,50%,45%)",  // dark cyan

    // Brass (warm, bright)
    horn: "hsl(40,70%,55%)",   // warm gold
    trumpet: "hsl(50,70%,60%)",   // bright yellow
    trombone: "hsl(35,60%,50%)",   // muted gold

    // Strings (greens/earthy, blended)
    violin: "hsl(120,50%,65%)",  // light green
    viola: "hsl(130,50%,60%)",  // slightly darker green
    cello: "hsl(140,50%,50%)",  // medium green
    bass: "hsl(150,50%,45%)",  // deep green
    pizzicato: "hsl(160,50%,55%)",  // mid green

    // Percussion (neutral/earthy for timpani, light for cymbals)
    timpani: "hsl(30,40%,30%)",   // deep brown
    cymbals: "hsl(50,60%,70%)",   // light gold

    // Keyboard / Synth
    piano: "hsl(0,0%,45%)",     // neutral gray
    synth: "hsl(270,40%,60%)",  // soft violet

    default: "hsl(0,0%,55%)",     // fallback neutral gray
};

function trackNameToFamily(name: string): string {
    for (const [regex, family] of NAME_TO_FAMILY) {
        if (regex.test(name)) return family;
    }
    return "default";
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

    // Optional blur filter
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
        const color = FAMILY_COLOR[familyKey] ?? FAMILY_COLOR.default;

        tracks.push({ name: trackName, color: color || 'na' });

        for (const note of track.notes) {
            const x = xOffset + (note.time / midiDuration) * width;
            const baseH = 2; // 1 semitone row
            const yBase = ((maxPitch - note.midi) / (maxPitch - minPitch)) * height;
            const durationW = (note.duration / midiDuration) * width;

            const velScale =
                velocityScaledHeight && note.velocity !== undefined
                    ? 0.5 + note.velocity * 0.5
                    : 1;

            let h = baseH * noteScaleFactor * velScale * (softNotes ? softNoteFactor : 1);
            if (h < minNoteHeight) h = minNoteHeight;

            const y = yBase - h / 2;

            rects.push({
                x,
                y,
                w: durationW,
                h,
                color: color || 'transparent',
                velocity: note.velocity ?? 0,
                rx: softNotes ? h / 2 : 0,
                ry: softNotes ? h / 2 : 0
            });
        }
    }

    return { width, height, rects, tracks, defs };
}
