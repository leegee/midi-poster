import type { SvgWriterOptions } from "./writeSvgAndPng";

export async function writeSvgAndPngBrowser({ svg, width, height }: SvgWriterOptions) {
    // 1. Create SVG Blob and load as image
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>(resolve => {
        img.onload = () => resolve();
        img.src = url;
    });

    // 2. Draw to canvas
    const canvas = document.createElement("canvas");
    canvas.width = width || img.width;
    canvas.height = height || img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 3. Helper to download
    function download(blob: Blob, filename: string) {
        const a = document.createElement("a");
        a.download = filename;
        a.href = URL.createObjectURL(blob);
        a.click();
        URL.revokeObjectURL(a.href);
    }

    // 4. Trigger downloads
    download(blob, "render.svg");
    const pngBlob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), "image/png"));
    download(pngBlob, "render.png");

    URL.revokeObjectURL(url);
}
