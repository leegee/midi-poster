import { Midi } from '@tonejs/midi';

export type RenderOptions = {
    width?: number;
    height?: number;
    pxPerSecond?: number;
    pitchRange?: [number, number];
    noteHeight?: number;
    background?: string;
    showGrid?: boolean;
    gridOpacity?: number;
    reverbIntensity?: number; // new high-level control
    xOffset?: number;
};

export type NoteRect = {
    midi: number;
    start: number;
    end: number;
    velocity: number;
    program: number | null;
    channel: number;
    trackName: string;
};

export type RenderedMidi = {
    width: number;
    height: number;
    rects: NoteRectRendered[];
    defs: string;
};

export type NoteRectRendered = {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    velocity: number;
    program: number | null;
    channel: number;
    noteId: string;
    start: number;
    end: number;
};

const DEFAULTS: RenderOptions = {
    width: 2048,
    height: 800,
    pitchRange: [21, 108],
    noteHeight: undefined,
    background: '#fff',
    showGrid: true,
    gridOpacity: 0.08,
    reverbIntensity: 1.0,
};

function programToHue(program: number | null | undefined): number {
    if (program == null) return 200;        // default blue
    if (program >= 0 && program <= 7) return 195;   // Piano/Keys
    if (program >= 8 && program <= 15) return 210;  // Chromatic percussion
    if (program >= 16 && program <= 31) return 50;  // Strings -> green
    if (program >= 32 && program <= 39) return 200; // Other Strings / harp
    if (program >= 40 && program <= 55) return 210; // Woodwinds -> blue
    if (program >= 56 && program <= 63) return 10;  // Brass -> orange
    if (program >= 64 && program <= 71) return 150; // Reed instruments / misc
    if (program >= 72 && program <= 79) return 275; // Pipe organ / others
    if (program >= 80 && program <= 87) return 300; // Synth
    if (program >= 88 && program <= 95) return 340; // Ethnic
    if (program >= 96 && program <= 103) return 25; // Percussion
    return 200;
}

function hsl(h: number, s: number, l: number) {
    return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

export function renderMidi(buf: ArrayBuffer | Uint8Array, opts?: RenderOptions): RenderedMidi {
    const o = { ...DEFAULTS, ...(opts || {}) };
    const midi = new Midi(buf as any);

    // Determine pitch bounds
    let [minP, maxP] = o.pitchRange!;
    if (!opts?.pitchRange) {
        for (const track of midi.tracks) {
            for (const note of track.notes) {
                minP = Math.min(minP, note.midi);
                maxP = Math.max(maxP, note.midi);
            }
        }
        minP = Math.max(0, minP - 2);
        maxP = Math.min(127, maxP + 2);
    }
    const pitchSpan = maxP - minP + 1;

    // Compute noteHeight to fit pitch range
    const verticalMargin = Math.max(40, o.height! * 0.1);
    if (!o.noteHeight) {
        o.noteHeight = (o.height! - 2 * verticalMargin) / pitchSpan;
    }

    // Collect all notes
    const allNotes: NoteRect[] = [];
    let maxTime = 0;
    for (const track of midi.tracks) {
        const program = track.instrument.number ?? null;
        const channel = track.channel ?? 0;
        const trackName = track.name || track.instrument.name || 'trk';
        for (const note of track.notes) {
            allNotes.push({
                midi: note.midi,
                start: note.time,
                end: note.time + note.duration,
                velocity: note.velocity ?? 0.5,
                program,
                channel,
                trackName,
            });
            maxTime = Math.max(maxTime, note.time + note.duration);
        }
    }

    // Scale horizontally to requested width
    o.pxPerSecond = o.width! / maxTime;
    const xForTime = (t: number) => Math.round(t * o.pxPerSecond!);
    const yForPitch = (p: number) =>
        Math.round(verticalMargin + (maxP - p) * o.noteHeight! + o.noteHeight! / 2);

    // Render notes
    const rects: NoteRectRendered[] = allNotes.map((note) => {
        const x = xForTime(note.start) + (opts?.xOffset ?? 0);
        const x2 = xForTime(note.end) + (opts?.xOffset ?? 0);
        const w = Math.max(1, x2 - x);
        const h = Math.max(1, o.noteHeight! * 0.9);
        const y = yForPitch(note.midi) - h / 2;
        const hue = programToHue(note.program);
        const sat = Math.min(90, 30 + note.velocity * 70);
        const light = Math.max(15, 60 - note.velocity * 40);
        return {
            x, y, w, h,
            color: hsl(hue, sat, light),
            velocity: note.velocity,
            program: note.program,
            channel: note.channel,
            noteId: `${note.trackName}-${note.midi}-${note.start}`,
            start: note.start,
            end: note.end,
        };
    });

    // Optional: simple reverb gradient defs
    const reverbDefs = `<defs>
    <filter id="reverb">
      <feGaussianBlur stdDeviation="${2 * o.reverbIntensity!}" />
    </filter>
  </defs>`;

    return {
        width: Math.max(o.width!, xForTime(maxTime) + 200),
        height: o.height!,
        rects,
        defs: reverbDefs,
    };
}
