import { Midi } from "@tonejs/midi";

export type NoteRectRendered = {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    velocity: number;
    rx?: number;  // corner radius x
    ry?: number;  // corner radius y
};

export type TrackInfo = {
    name: string;
    color: string;
};

export type RenderedMidi = {
    width: number;
    height: number;
    rects: NoteRectRendered[];
    tracks: TrackInfo[];
};

function programToHue(program: number | null | undefined, trackName: string = ''): number {
    const name = trackName.toLowerCase();

    const instrumentMap: [RegExp, number][] = [
        [/piano|pianoforte|fortepiano/, 195],
        [/violino|viola|violoncello|cello|contrabbasso|archi/, 38],
        [/tromba|trombone|corno|tuba|ottoni/, 275],
        [/flauto|oboe|clarinetto|fagotto/, 300],
        [/tamburo|batteria|timpani|percussioni/, 210],
        [/synth|tastiera|organo/, 50]
    ];

    for (const [regex, hue] of instrumentMap) {
        if (regex.test(name)) return hue;
    }

    if (program != null) {
        if (program >= 0 && program <= 7) return 195;
        if (program >= 8 && program <= 15) return 210;
        if (program >= 16 && program <= 31) return 50;
        if (program >= 32 && program <= 39) return 40;
        if (program >= 40 && program <= 55) return 38;
        if (program >= 56 && program <= 63) return 10;
        if (program >= 64 && program <= 71) return 150;
        if (program >= 72 && program <= 79) return 275;
        if (program >= 80 && program <= 87) return 300;
        if (program >= 88 && program <= 95) return 340;
        if (program >= 96 && program <= 103) return 25;
        return 200;
    }

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) % 360;
    }
    return 30 + (hash % 300);
}

export function renderMidi(
    midi: Midi,
    options: { xOffset?: number; pitchRange?: [number, number]; width?: number; height?: number; reverbIntensity?: number } = {}
): RenderedMidi {
    const { xOffset = 0, pitchRange = [0, 127], width = 1000, height = 300 } = options;
    const [minPitch, maxPitch] = pitchRange;

    const rects: NoteRectRendered[] = [];
    const tracks: TrackInfo[] = [];

    const midiDuration = midi.duration || 1;

    for (const track of midi.tracks) {
        const program = track.instrument.number ?? null;
        const trackName = track.name || track.instrument.name || '';
        const hue = programToHue(program, trackName);

        tracks.push({ name: trackName, color: `hsl(${hue},70%,50%)` });

        for (const note of track.notes) {
            const x = xOffset + (note.time / midiDuration) * width;
            const y = ((maxPitch - note.midi) / (maxPitch - minPitch)) * height;
            const w = (note.duration / midiDuration) * width;
            const baseH = 2; // minimal height
            const h = baseH * (0.3 + 0.7 * note.velocity); // scale with velocity

            // Store rx/ry for smoother capsule shapes
            const rx = Math.max(1, w * 0.2);
            const ry = Math.max(1, h / 2);

            rects.push({
                x, y, w, h,
                color: `hsl(${hue},70%,50%)`,
                velocity: note.velocity,
                // optional for midi-row: store corner radius
                rx,
                ry
            });
        }
    }

    return { width, height, rects, tracks };
}
