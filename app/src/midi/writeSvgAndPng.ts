export interface SvgWriterOptions {
    svg: string;
    outputPath?: string;   // only used in Node
    width?: number;
    height?: number;
}

/**
 * Writes an SVG and converts it to PNG.
 * Works in both Node/Bun (saves to disk) and Browser (downloads files).
 */
export async function writeSvgAndPng(opts: SvgWriterOptions): Promise<void> {
    if (typeof window === "undefined") {
        const { writeSvgAndPngNode } = await import("./writeSvgAndPngNode");
        return writeSvgAndPngNode(opts);
    } else {
        const { writeSvgAndPngBrowser } = await import("./writeSvgAndPngBrowser");
        return writeSvgAndPngBrowser(opts);
    }
}
