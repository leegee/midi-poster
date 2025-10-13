export interface DensityFeature {
    x: number;
    y: number;
    width: number;
    height: number;
    avgDensity: number;
    maxDensity: number;
    cells: DensityCell[];
}

export interface DensityCell {
    t: number;        // time index
    pitch: number;    // pitch index
    value: number;    // raw density
    norm: number;     // normalized [0..1]
}

export function extractDensityFeatures(
    density: DensityCell[],
    meta: { timeStep: number; pitchStep: number },
    width: number,
    height: number,
    topN = 5,
): DensityFeature[] {
    // Convert to a 2D grid
    const timeBins = Math.max(...density.map(d => d.t)) + 1;
    const pitchBins = Math.max(...density.map(d => d.pitch)) + 1;
    const grid: number[][] = Array.from({ length: pitchBins }, () => Array(timeBins).fill(0));
    for (const d of density) grid[d.pitch][d.t] = d.norm;

    // Simple smoothing (3x3 average)
    const smooth: number[][] = Array.from({ length: pitchBins }, () => Array(timeBins).fill(0));
    for (let y = 1; y < pitchBins - 1; y++) {
        for (let x = 1; x < timeBins - 1; x++) {
            let sum = 0;
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++)
                    sum += grid[y + dy][x + dx];
            smooth[y][x] = sum / 9;
        }
    }

    // Threshold based on global mean
    const allValues = smooth.flat();
    const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    const threshold = mean * 1.5; // tune as needed

    // Find blobs via flood-fill
    const visited = new Set<string>();
    const features: DensityFeature[] = [];

    function flood(x: number, y: number): DensityCell[] {
        const cells: DensityCell[] = [];
        const stack = [[x, y]];
        while (stack.length) {
            const [cx, cy] = stack.pop()!;
            const key = `${cx},${cy}`;
            if (visited.has(key)) continue;
            visited.add(key);
            if (smooth[cy]?.[cx] > threshold) {
                cells.push({ t: cx, pitch: cy, value: smooth[cy][cx], norm: smooth[cy][cx] });
                for (let dy = -1; dy <= 1; dy++)
                    for (let dx = -1; dx <= 1; dx++)
                        if (dx || dy) stack.push([cx + dx, cy + dy]);
            }
        }
        return cells;
    }

    for (let y = 0; y < pitchBins; y++) {
        for (let x = 0; x < timeBins; x++) {
            if (!visited.has(`${x},${y}`) && smooth[y][x] > threshold) {
                const cells = flood(x, y);
                if (cells.length > 0) {
                    const xs = cells.map(c => c.t);
                    const ys = cells.map(c => c.pitch);
                    const avgDensity = cells.reduce((a, c) => a + c.norm, 0) / cells.length;
                    const maxDensity = Math.max(...cells.map(c => c.norm));
                    features.push({
                        x: Math.min(...xs) * meta.timeStep,
                        y: Math.min(...ys) * meta.pitchStep,
                        width: (Math.max(...xs) - Math.min(...xs) + 1) * meta.timeStep,
                        height: (Math.max(...ys) - Math.min(...ys) + 1) * meta.pitchStep,
                        avgDensity,
                        maxDensity,
                        cells,
                    });
                }
            }
        }
    }

    // Rank and return top N by area × density
    return features
        .sort((a, b) => (b.avgDensity * b.width * b.height) - (a.avgDensity * a.width * a.height))
        .slice(0, topN);
}


export function renderDensityFeatures(
    features: DensityFeature[] | undefined,
    width: number,
    height: number
): string {
    console.log('renderDensityFeatures', features?.length)
    if (!features?.length) return "";

    return features
        .map(f => {
            const hue = Math.round(200 + 80 * f.maxDensity);
            const opacity = 0.25 + 0.5 * f.avgDensity; // scale alpha by density

            //   fill="hsla(${hue},70%,70%,${opacity.toFixed(2)})" 
            //   fill="hsla(${hue},70%,70%,${opacity})"
            //   stroke="hsla(${hue},50%,90%,${opacity.toFixed(2)})" 
            //   stroke-width="1.5" 

            return `<rect 
                x="${f.x.toFixed(2)}" 
                y="${height - f.y - f.height}" 
                width="${f.width.toFixed(2)}" 
                height="${f.height.toFixed(2)}" 
                rx="${Math.min(f.width, f.height)}"
                ry="${Math.min(f.width, f.height)}"
                fill="white"
                fill-opacity="0.15"
                filter="url(#feature-glow)"
                stroke="white"
                stroke-opacity="0.8"
                stroke-width="2"
                style="mix-blend-mode: soft-light;"
            />`;
        })
        .join("\n");
}
