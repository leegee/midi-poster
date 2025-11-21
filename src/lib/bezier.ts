// bezier.ts
export interface CurvePoint {
    x: number;
    y: number;
    w: number; // thickness driver
}

export interface BezierSegment {
    start: CurvePoint;
    cp1: CurvePoint;
    cp2: CurvePoint;
    end: CurvePoint;
}

/**
 * Convert an array of points to contiguous cubic Bezier segments using Catmull-Rom.
 */
export function createBezierFromPoints(points: CurvePoint[]): BezierSegment[] {
    if (points.length < 2) return [];

    const segments: BezierSegment[] = [];

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? p2;

        const cp1: CurvePoint = {
            x: p1.x + (p2.x - p0.x) / 6,
            y: p1.y + (p2.y - p0.y) / 6,
            w: p1.w,
        };

        const cp2: CurvePoint = {
            x: p2.x - (p3.x - p1.x) / 6,
            y: p2.y - (p3.y - p1.y) / 6,
            w: p2.w,
        };

        segments.push({
            start: p1,
            cp1,
            cp2,
            end: p2,
        });
    }

    return segments;
}
