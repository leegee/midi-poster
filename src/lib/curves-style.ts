export interface CurveStyleOptions {
    minWidth: number;
    maxWidth: number;
    gapPx: number;
}

/**
 * Compute thickness from velocity + density
 */
export function thicknessFromVelocity(
    velocity: number,
    density: number,
    { minWidth, maxWidth }: CurveStyleOptions
): number {
    const vWeight = 0.5 + velocity * 0.5;
    const dWeight = 1 + density * 2;
    return Math.max(minWidth, Math.min(maxWidth, vWeight * dWeight));
}

/**
 * Should two adjacent notes be connected in one curve?
 */
export function notesContinuous(
    x1: number,
    width1: number,
    x2: number,
    { gapPx }: CurveStyleOptions
): boolean {
    return x1 + width1 >= x2 - gapPx;
}
