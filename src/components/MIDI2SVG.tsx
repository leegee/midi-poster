import { createEffect, createSignal, Show, onCleanup } from "solid-js";
import { renderMidi, type RenderOptions } from "~/midi/midi-render";
import { createSvg } from "~/midi/midi-row";
import debounce from "just-debounce";
import { busyStore } from "~/stores/busy-store";
import { extractDensityFeatures } from "~/lib/density-feature";

type Props = {
    title: string;
    midiFiles: File[];
    args: RenderOptions & { calls: number };
};

type RenderResponse = { imageUrl: string | null };

export default function MIDI2SVG(props: Props) {
    const [imageUrl, setimageUrl] = createSignal<string | null>(null);
    const [currentCallId, setCurrentCallId] = createSignal(-1);

    let renderSeq = 0;
    let lastAbortController: AbortController | null = null;
    let worker: Worker | null = null;
    let lastFiles: File[] = [];
    let lastArgs: Props["args"] | null = null;

    // Initialize worker only on client
    if (typeof window !== "undefined" && !worker) {
        worker = new Worker(new URL("./svg-render.worker.ts", import.meta.url), {
            type: "module",
        });
    }

    onCleanup(() => {
        if (worker) {
            worker.terminate();
            worker = null;
        }
        if (imageUrl()) URL.revokeObjectURL(imageUrl()!);
        if (lastAbortController) lastAbortController.abort();
        try {
            // @ts-ignore
            debouncedRender.cancel?.();
        } catch { }
    });

    // Watch props
    createEffect(() => {
        if (!props.midiFiles.length) {
            if (imageUrl()) URL.revokeObjectURL(imageUrl()!);
            setimageUrl(null);
            return;
        }

        if (!propsChanged(props.midiFiles, props.args)) return;

        debouncedRender(props.midiFiles, props.args);
    });

    const propsChanged = (files: File[], args: Props["args"]) => {
        // If no files, clear but don't re-render repeatedly
        if (!files.length) {
            lastFiles = [];
            lastArgs = null;
            return true;
        }

        // Check if file list changed (only checking name + size is enough here)
        const filesChanged =
            files.length !== lastFiles.length ||
            files.some((f, i) => !lastFiles[i] || f.name !== lastFiles[i].name || f.size !== lastFiles[i].size);

        // Check args (shallow compare)
        const argsChanged =
            !lastArgs ||
            Object.keys(args).some(k => (args as any)[k] !== (lastArgs as any)[k]);

        // Update snapshots if changed
        if (filesChanged || argsChanged) {
            lastFiles = files.slice();
            lastArgs = { ...args };
            return true;
        }

        return false;
    };

    const debouncedRender = debounce(async (files: File[], args: Props["args"]) => {
        if (!files.length) {
            setimageUrl(null);
            return;
        }

        const myId = ++renderSeq;
        setCurrentCallId(myId);

        // Abort previous render
        if (lastAbortController) lastAbortController.abort();
        const abortController = new AbortController();
        lastAbortController = abortController;
        const { signal } = abortController;

        try {
            busyStore.setBusy(true);

            if (signal.aborted || myId !== renderSeq) return;

            // Only take the last file for now
            const file = files[files.length - 1];
            await render(file, args);

        } catch (err: any) {
            if (err?.name !== "AbortError") console.error("Render failed:", err);
        } finally {
            if (myId === renderSeq) busyStore.setBusy(false);
            if (lastAbortController === abortController) lastAbortController = null;
        }
    }, 300);

    async function render(file: File, args: RenderOptions) {
        const { Midi } = await import("@tonejs/midi/dist/Midi.js");

        const buffer = await file.arrayBuffer();

        const midi = new Midi(buffer);

        const rendered = renderMidi(midi, args);

        if (rendered.density && rendered.densityMeta) {
            rendered.features = extractDensityFeatures(
                rendered.density,
                rendered.densityMeta,
                rendered.width,
                rendered.height,
                5
            );
        }

        const { svg } = createSvg([rendered], args);

        if (!worker) return;

        // Setup worker listener
        worker.onmessage = (ev: MessageEvent<RenderResponse>) => {
            console.log(ev);
            if (ev.data.imageUrl
                // && myId === renderSeq
            ) {
                if (imageUrl()) URL.revokeObjectURL(imageUrl()!);
                console.log('Set new image')
                setimageUrl(ev.data.imageUrl);
            }
        };

        worker.postMessage({
            svg,
            width: Number(args.targetWidth ?? args.width),
            height: Number(args.targetHeight ?? args.height),
        });
    }

    return (
        <Show when={imageUrl()} fallback={<p>Upload MIDI files to preview</p>}>
            <Show
                when={!busyStore.busy}
                fallback={
                    <section class="center-align middle-align extra">
                        <div class="shape loading-indicator extra">
                            <img class="responsive" src="/favicon.png" />
                        </div>
                    </section>
                }
            >
                <fieldset style="display:flex; padding: 2rem; justify-content:center;" class={busyStore.busy ? "busy" : ""}>
                    <legend class="large-text code border">
                        <code>{busyStore.busy ? "BUILDING" : props.title}</code>
                    </legend>

                    <img
                        src={imageUrl()!}
                        alt="MIDI visualization"
                        style={{
                            width: props.args.targetWidth ? `${props.args.targetWidth}px` : "auto",
                            height: props.args.targetHeight ? `${props.args.targetHeight}px` : "auto",
                            "image-rendering": "crisp-edges",
                        }}
                    />
                </fieldset>
            </Show>
        </Show>
    );
}

async function hash(svg: string) {
    const a = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(svg));
    return Array.from(new Uint8Array(a), b => b.toString(16).padStart(2, "0")).join("");
}
