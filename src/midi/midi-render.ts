import { type Midi } from "@tonejs/midi";
import { trackNameToFamily } from "../colours";
import { DensityCell, DensityFeature } from "~/lib/density-feature";
import { getFamilyColor } from "~/stores/color";
import { CurvePoint, createBezierFromPoints } from "~/lib/bezier";
import { thicknessFromVelocity, notesContinuous } from "~/lib/curves-style";
import { isTrackMonophonic } from "~/lib/is-monophonic";

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

export interface CurveRendered {
    color: string;
    path: string;
    width: number;
}

export interface RenderedMidi {
    width: number;
    height: number;
    rects: NoteRectRendered[];
    curves: CurveRendered[];
    tracks: TrackInfo[];
    defs?: string;
    density?: DensityCell[];
    densityMeta?: {
        timeStep: number;
        pitchStep: number;
        maxDensity: number;
    };
    features?: DensityFeature[];
}

export interface RenderOptions {
    renderFeatures?: boolean;
    reverbIntensity?: number;
    blur?: number;
    xOffset?: number;
    pitchRange?: [number, number];
    width?: number;
    height?: number;
    targetWidth?: number;
    targetHeight?: number;
    softNotes?: boolean;
    softNoteFactor?: number;
    noteHeightScaleFactor?: number;
    noteWidthScaleFactor?: number;
    minNoteHeight?: number;
    velocityScaledHeight?: boolean;
    blendMode?: string;
    densityScaleFactor?: number;
    densityTimeDivision?: number;
    double?: boolean;
    background?: string;
    topLayerNoBlur?: boolean;
    useCurves?: boolean;
    curveOptions?: {
        minWidth: number;
        maxWidth: number;
        gapPx: number;
    };
}

// ---------------------- helpers ----------------------

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

// ---------------------- main function ----------------------

export function renderMidi(midi: Midi, options: RenderOptions = {}): RenderedMidi {
    const {
        width = 1000,
        height = 300,
        targetWidth = width,
        targetHeight = height,
        xOffset = 0,
        pitchRange = [0, 127],
        softNotes = false,
        softNoteFactor = 3,
        noteHeightScaleFactor = 1,
        noteWidthScaleFactor = 1,
        minNoteHeight = 1.5,
        velocityScaledHeight = true,
        densityScaleFactor = DENSITY_SCALE_FACTOR,
        useCurves = false,
        curveOptions = { minWidth: 1.2, maxWidth: 6, gapPx: 7 },
    } = options;

    const scaleX = targetWidth / width;
    const scaleY = targetHeight / height;
    const [minPitch, maxPitch] = pitchRange;

    const rects: NoteRectRendered[] = [];
    const tracks: TrackInfo[] = [];
    const trackCanCurve: Record<string, boolean> = {};
    const curves: CurveRendered[] = [];
    const tempRects: {
        note: any;
        trackFamily: string;
        x: number;
        yBase: number;
        velScale: number;
        hBase: number;
        wBase: number;
    }[] = [];

    const midiDuration = midi.duration || 1;

    // ------------------ track loop ------------------

    for (const track of midi.tracks) {
        const trackName = track.name || track.instrument.name || "";
        if (trackName.match(TRACK_SKIP_RE)) continue;
        const familyKey = trackNameToFamily(trackName);

        tracks.push({
            name: trackName,
            color: getFamilyColor(familyKey) ?? "#ffffff"
        });

        trackCanCurve[familyKey] = useCurves && isTrackMonophonic(track);

        for (const note of track.notes) {
            const xBase = xOffset + (note.time / midiDuration) * width;
            const yBase = ((maxPitch - note.midi) / (maxPitch - minPitch)) * height;

            const durationW = (note.duration / midiDuration) * width;
            const scaledW = durationW * noteWidthScaleFactor;

            const velScale = velocityScaledHeight ? 0.5 + (note.velocity ?? 0) * 0.5 : 1;
            let h = 2 * noteHeightScaleFactor * velScale * (softNotes ? softNoteFactor : 1);
            if (h < minNoteHeight) h = minNoteHeight;

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

    // ------------------ density map ------------------

    const tempo = midi.header.tempos?.[0]?.bpm ?? 120;
    const secondsPerBeat = 60 / tempo;
    const timeDivisionBeats = options.densityTimeDivision ?? 0.25;
    const timeStepDuration = secondsPerBeat * timeDivisionBeats;
    const timeStep = (timeStepDuration / midi.duration) * width;
    const pitchStep = 1;

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

    // ------------------ finalize rects and build curves ------------------

    const trackCurvePoints: Record<string, CurvePoint[]> = {};

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
        let shape: "rect" | "star" = ["cymbals"].includes(r.trackFamily) ? "star" : "rect";

        const wFinal = shape === "star" ? hFinal * STAR_SCALE : r.wBase;

        let yFinal: number;
        if (r.trackFamily === "timpani") {
            const timpaniNotes = tempRects.filter(t => t.trackFamily === "timpani");
            const minT = Math.min(...timpaniNotes.map(n => n.note.midi));
            const maxT = Math.max(...timpaniNotes.map(n => n.note.midi));
            const bottomRange = height * 0.2;
            yFinal =
                3 * ((maxT - r.note.midi) / (maxT - minT)) * bottomRange + (height - bottomRange) - height / 1.66;
            shape = "star";
        } else if (shape === "star") {
            yFinal = height / 2 - hFinal / 2;
        } else {
            yFinal = r.yBase - hFinal / 2;
        }

        const xScaled = r.x * scaleX;
        const yScaled = yFinal * scaleY;
        const wScaled = wFinal * scaleX;
        const hScaled = hFinal * scaleY;

        const starPoints =
            shape === "star" ? makeStarPoints(xScaled + wScaled / 2, yScaled + hScaled / 2, hScaled / 2) : undefined;

        const filterId = softNotes ? `url(#blur${Math.max(0, 4 - Math.floor((r.note.velocity ?? 0) * 5))})` : undefined;

        let color = getFamilyColor(r.trackFamily) ?? "#ffffff";
        if (color.startsWith("hsl")) {
            color = color.replace(/(\d+)%\)$/i, (match, l) => `${Math.min(100, +l + (100 - +l) * 0.3 * density)}% )`);
        } else if (color.startsWith("rgb")) {
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
            rx: softNotes ? Math.min(hScaled / 2, 2) : 0,
            ry: softNotes ? Math.min(hScaled / 2, 2) : 0,
            shape,
            starPoints,
            filter: hFinal > 0 ? filterId : undefined
        });

        // ---------------- build curve points ----------------
        if (trackCanCurve[r.trackFamily]) {
            const pointX = xScaled + wScaled / 2;
            const pointY = yScaled + hScaled / 2;
            const thickness = Math.min(
                thicknessFromVelocity(r.note.velocity ?? 0, density, curveOptions),
                curveOptions.maxWidth
            );
            (trackCurvePoints[r.trackFamily] ??= []).push({
                x: pointX,
                y: pointY,
                w: thickness,
            });
        }
    }

    // ---------------- generate curves ----------------
    if (useCurves) {
        for (const [family, points] of Object.entries(trackCurvePoints)) {
            if (!trackCanCurve[family]) continue;
            if (!points || points.length < 2) continue;

            const sortedPoints = points.slice().sort((a, b) => a.x - b.x);

            const mergedSegments: CurvePoint[][] = [];
            let buffer: CurvePoint[] = [];

            for (let i = 0; i < sortedPoints.length; i++) {
                const p = sortedPoints[i];
                const prev = buffer[buffer.length - 1];
                if (!prev || (p.x - prev.x <= curveOptions.gapPx)) {
                    buffer.push(p);
                } else {
                    if (buffer.length >= 2) mergedSegments.push(buffer);
                    buffer = [p];
                }
            }
            if (buffer.length >= 2) mergedSegments.push(buffer);

            const color = getFamilyColor(family) ?? "#fff";

            for (const segment of mergedSegments) {
                const pathSegments = createBezierFromPoints(segment);
                for (const seg of pathSegments) {
                    curves.push({
                        color,
                        path: `M${seg.start.x},${seg.start.y} C${seg.cp1.x},${seg.cp1.y},${seg.cp2.x},${seg.cp2.y},${seg.end.x},${seg.end.y}`,
                        width: Math.max(...segment.map(p => Math.min(p.w, curveOptions.maxWidth))),
                    });
                }
            }
        }
    }

    // ---------------- density map for external use ----------------

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
        curves,
        tracks,
        defs: undefined,
        density,
        densityMeta: { timeStep, pitchStep, maxDensity },
    };
}
