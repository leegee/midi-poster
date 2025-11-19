import { createSignal, createEffect, onMount } from "solid-js";
import { Portal } from "solid-js/web";

interface ColorPickerProps {
    label?: string;
    value: string; // any valid CSS color
    onChange: (newColor: string) => void;
}

export default function ColorPicker(props: ColorPickerProps) {
    const [open, setOpen] = createSignal(false);

    const [h, setH] = createSignal(0);
    const [s, setS] = createSignal(0);
    const [l, setL] = createSignal(0);
    const [alpha, setAlpha] = createSignal(1);

    const [tempColorStr, setTempColorStr] = createSignal("");

    let canvasRef: HTMLCanvasElement | undefined;

    // Convert any CSS color to {r,g,b,a}
    const parseCssColor = (css: string) => {
        const el = document.createElement("div");
        el.style.color = css;
        document.body.appendChild(el);
        const rgb = getComputedStyle(el).color;
        document.body.removeChild(el);

        const m = rgb.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
        if (!m) return { r: 0, g: 0, b: 0, a: 1 };
        return {
            r: parseInt(m[1]),
            g: parseInt(m[2]),
            b: parseInt(m[3]),
            a: m[4] ? parseFloat(m[4]) : 1
        };
    };

    const rgbToHsl = (r: number, g: number, b: number) => {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        const d = max - min;
        if (d !== 0) {
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h *= 60;
        }
        return { h, s: s * 100, l: l * 100 };
    };

    function hslToRgb(h: number, s: number, l: number) {
        h /= 360;
        s /= 100;
        l /= 100;
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

    const initFromProps = () => {
        const { r, g, b, a } = parseCssColor(props.value);
        const { h: hh, s: ss, l: ll } = rgbToHsl(r, g, b);
        setH(hh);
        setS(ss);
        setL(ll);
        setAlpha(a);
    };

    const updateTempColorStr = () => {
        setTempColorStr(`hsla(${h()}, ${s()}%, ${l()}%, ${alpha()})`);
    };

    const drawCanvas = () => {
        if (!canvasRef) return;
        const ctx = canvasRef.getContext("2d");
        if (!ctx) return;

        const width = canvasRef.width;
        const height = canvasRef.height;
        const image = ctx.createImageData(width, height);

        for (let y = 0; y < height; y++) {
            const lightness = 1 - y / height;
            for (let x = 0; x < width; x++) {
                const hue = (x / width) * 360;
                const { r, g, b } = hslToRgb(hue, 100, lightness * 100);
                const idx = (y * width + x) * 4;
                image.data[idx] = r;
                image.data[idx + 1] = g;
                image.data[idx + 2] = b;
                image.data[idx + 3] = 255;
            }
        }

        ctx.putImageData(image, 0, 0);
    };

    const pickColor = (e: MouseEvent) => {
        if (!canvasRef) return;
        const rect = canvasRef.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ctx = canvasRef.getContext("2d");
        if (!ctx) return;
        const data = ctx.getImageData(x, y, 1, 1).data;
        const { h: hh, s: ss, l: ll } = rgbToHsl(data[0], data[1], data[2]);
        setH(hh);
        setS(ss);
        setL(ll);
        updateTempColorStr();
    };

    const saveColor = () => {
        props.onChange(tempColorStr());
        setOpen(false);
    };

    const cancel = () => {
        initFromProps();
        updateTempColorStr();
        setOpen(false);
    };

    onMount(() => {
        initFromProps();
        updateTempColorStr();
        if (!canvasRef) return;
        canvasRef.width = 300;
        canvasRef.height = 200;
        drawCanvas();
    });

    // Redraw when picker opens
    createEffect(() => {
        if (open() && canvasRef) drawCanvas();
    });

    // Update preview when any component changes
    createEffect(updateTempColorStr);

    return (
        <>
            <div style="display:flex; align-items:center; gap:0.5em;">
                <button class="small transparent" onClick={() => setOpen(true)}>
                    <div style={`height: 1em;width:2em; background:${tempColorStr()}; cursor:pointer;`} />
                    {props.label && <span>{props.label}</span>}
                </button>
            </div >

            {open() && (
                <Portal>
                    <div class="overlay blur active" />
                    <dialog class="surface-container-high active" onClick={cancel}>
                        <div onClick={(e) => e.stopPropagation()}>
                            <canvas
                                class="no-round border"
                                ref={canvasRef}
                                width={300}
                                height={200}
                                style="cursor:crosshair;"
                                onClick={pickColor}
                            />
                            <div class="padding row">
                                <div style={`width:32px; height:32px; border:1px solid #000; background:${tempColorStr()}`} />
                                <label>Alpha</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={alpha()}
                                    onInput={(e) => { setAlpha(parseFloat(e.currentTarget.value)); updateTempColorStr(); }}
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
            )
            }
        </>
    );
}
