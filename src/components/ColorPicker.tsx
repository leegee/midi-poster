import { createSignal, createEffect, onMount } from "solid-js";
import { Portal } from "solid-js/web";

interface ColorPickerProps {
    label?: string;
    value: string; // rgba(r,g,b,a)
    onChange: (newColor: string) => void;
}

export default function ColorPicker(props: ColorPickerProps) {
    const [open, setOpen] = createSignal(false);
    const [tempColor, setTempColor] = createSignal(props.value);
    const [alpha, setAlpha] = createSignal(1);
    let canvasRef: HTMLCanvasElement | undefined;

    const rgbaToComponents = (rgba: string) => {
        const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]*)?\)/);
        return m
            ? { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]), a: m[4] ? parseFloat(m[4]) : 1 }
            : { r: 0, g: 0, b: 0, a: 1 };
    };

    function hslToRgb(h: number, s: number, l: number) {
        h /= 360;
        let r: number, g: number, b: number;
        if (s === 0) r = g = b = l;
        else {
            const hue2rgb = (p: number, q: number, t: number) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    }

    // Draw the hue/lightness canvas
    const drawCanvas = () => {
        if (!canvasRef) return;
        const ctx = canvasRef.getContext("2d");
        if (!ctx) return;

        const width = canvasRef.width;
        const height = canvasRef.height;
        const image = ctx.createImageData(width, height);

        for (let y = 0; y < height; y++) {
            const lightness = 1 - y / height; // top = 1, bottom = 0
            for (let x = 0; x < width; x++) {
                const hue = (x / width) * 360;
                const { r, g, b } = hslToRgb(hue, 1, lightness / 2 + 0.25);
                const idx = (y * width + x) * 4;
                image.data[idx] = r;
                image.data[idx + 1] = g;
                image.data[idx + 2] = b;
                image.data[idx + 3] = 255;
            }
        }

        ctx.putImageData(image, 0, 0);
    };

    // Pick color from canvas
    const pickColor = (e: MouseEvent) => {
        if (!canvasRef) return;
        const rect = canvasRef.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ctx = canvasRef.getContext("2d");
        if (!ctx) return;
        const data = ctx.getImageData(x, y, 1, 1).data;
        setTempColor(`rgba(${data[0]},${data[1]},${data[2]},${alpha()})`);
    };

    const saveColor = () => {
        props.onChange(tempColor());
        setOpen(false);
    };

    const cancel = () => {
        setTempColor(props.value);
        setAlpha(rgbaToComponents(props.value).a);
        setOpen(false);
    };

    onMount(() => {
        if (!canvasRef) return;
        canvasRef.width = 300;
        canvasRef.height = 200;
        drawCanvas();
    });

    // Redraw whenever the picker opens
    createEffect(() => {
        if (open() && canvasRef) drawCanvas();
    });

    // Update tempColor when alpha changes
    createEffect(() => {
        const { r, g, b } = rgbaToComponents(tempColor());
        setTempColor(`rgba(${r},${g},${b},${alpha()})`);
    });

    return (
        <>
            <div style="display:flex; align-items:center; gap:0.5em;">
                <button
                    class="chip"
                    onClick={() => setOpen(true)}
                >
                    <div style={`height: 1em;width:2em; background:${props.value}; cursor:pointer;`} />
                    {props.label && <span>{props.label}</span>}
                </button>
            </div>

            {open() && (
                <Portal>
                    <div class="overlay blur active" />
                    <dialog class="surface-container-high active"
                        onClick={cancel}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                        >
                            <canvas
                                class="no-round border"
                                ref={canvasRef}
                                width={300}
                                height={200}
                                style="cursor:crosshair;"
                                onClick={pickColor}
                            />

                            <div class="padding row">
                                <div style={`width:32px; height:32px; border:1px solid #000; background:${tempColor()}`} />
                                <label>Alpha</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={alpha()}
                                    onInput={(e) => setAlpha(parseFloat(e.currentTarget.value))}
                                />
                            </div>

                            <footer>
                                <nav class="right-align">
                                    <button class="transparent" onClick={cancel}>Cancel</button>
                                    <button class="primary" onClick={saveColor}>Save</button>
                                </nav>
                            </footer>
                        </div>
                    </dialog>
                </Portal>
            )}
        </>
    );
}
