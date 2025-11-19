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

type RenderResponse = { pngUrl: string | null };

export default function MIDI2SVG(props: Props) {
    const [pngUrl, setPngUrl] = createSignal<string | null>(null);
    const [currentCallId, setCurrentCallId] = createSignal(-1);

    let renderSeq = 0;
    let lastAbortController: AbortController | null = null;
    let worker: Worker | null = null;

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
        if (pngUrl()) URL.revokeObjectURL(pngUrl()!);
        if (lastAbortController) lastAbortController.abort();
        try {
            // @ts-ignore
            debouncedRender.cancel?.();
        } catch { }
    });

    const propsChanged = (files: File[], args: Props["args"]) => {
        if (!files.length) return true;
        return true;
    };

    const debouncedRender = debounce(async (files: File[], args: Props["args"]) => {
        if (!files.length) {
            setPngUrl(null);
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

            const { Midi } = await import("@tonejs/midi/dist/Midi.js");
            if (signal.aborted || myId !== renderSeq) return;

            // Only take the last file for now
            const file = files[files.length - 1];
            const buffer = await file.arrayBuffer();
            if (signal.aborted || myId !== renderSeq) return;

            const midi = new Midi(buffer);
            if (signal.aborted || myId !== renderSeq) return;

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
            if (signal.aborted || myId !== renderSeq) return;

            if (!worker) return;

            // Setup worker listener
            worker.onmessage = (ev: MessageEvent<RenderResponse>) => {
                if (ev.data.pngUrl && myId === renderSeq) {
                    if (pngUrl()) URL.revokeObjectURL(pngUrl()!);
                    setPngUrl(ev.data.pngUrl);
                }
            };

            // Post SVG to worker
            worker.postMessage({
                svg,
                width: Number(args.targetWidth ?? args.width),
                height: Number(args.targetHeight ?? args.height),
            });

        } catch (err: any) {
            if (err?.name !== "AbortError") console.error("Render failed:", err);
        } finally {
            if (myId === renderSeq) busyStore.setBusy(false);
            if (lastAbortController === abortController) lastAbortController = null;
        }
    }, 300);

    // Watch props
    createEffect(() => {
        if (!props.midiFiles.length) {
            if (pngUrl()) URL.revokeObjectURL(pngUrl()!);
            setPngUrl(null);
            return;
        }

        if (!propsChanged(props.midiFiles, props.args)) return;

        debouncedRender(props.midiFiles, props.args);
    });

    return (
        <Show when={pngUrl()} fallback={<p>Upload MIDI files to preview</p>}>
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
                        src={pngUrl()!}
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
