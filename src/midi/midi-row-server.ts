import sharp from "sharp";

export async function writePngFromSvg(
    svg: string,
    svgOutPath: string,
    targetWidth?: number,
    targetHeight?: number
) {
    const pngOutputPath = svgOutPath.replace(/\.svg$/i, ".png");

    let pipeline = sharp(Buffer.from(svg)).png();

    if (targetWidth || targetHeight) {
        pipeline = pipeline.resize({
            fit: "contain",
            ...(targetWidth ? { width: targetWidth } : { height: targetHeight }),
        });
    }

    await pipeline.toFile(pngOutputPath);
    console.log(new Date().toLocaleTimeString(), "Wrote", pngOutputPath);
}
