import { createEffect, createSignal, Show, onCleanup } from "solid-js";
import { renderMidi, type RenderOptions } from "~/midi/midi-render";
import { createSvg } from "~/midi/midi-row";
import debounce from "just-debounce";
import { busyStore } from "~/stores/busy-store";
import { extractDensityFeatures } from "~/lib/density-feature";
import { Canvg } from "canvg";

type Props = {
    title: string;
    midiFiles: File[];
    args: RenderOptions & { calls: number };
};

export default function MIDI2SVG(props: Props) {
    const [pngUrl, setPngUrl] = createSignal<string | null>(null);
    const [currentCallId, setCurrentCallId] = createSignal(-1);

    let lastProps: { files: string[]; args: any } | null = null;

    // renderSeq increments for each actual render attempt.
    // Only the render that has id === latestRenderSeq is allowed to set state.
    let renderSeq = 0;
    let lastAbortController: AbortController | null = null;

    // Helper to compare props (keeps your original semantics)
    const propsChanged = (files: File[], args: Props["args"]) => {
        const fileNames = files.map((f) => f.name);
        if (!lastProps) return true;
        if (fileNames.length !== lastProps.files.length) return true;
        for (let i = 0; i < fileNames.length; i++) {
            if (fileNames[i] !== lastProps.files[i]) return true;
        }
        const argKeys = Object.keys(args);
        const lastArgs = lastProps.args;
        if (argKeys.length !== Object.keys(lastArgs).length) return true;
        for (const key of argKeys) {
            // shallow compare; matches your original code
            if (args[key as keyof typeof args] !== lastArgs[key]) return true;
        }
        return false;
    };

    // Debounced render function - wrapped to use per-render sequence id
    const debouncedRender = debounce(async (files: File[], args: Props["args"]) => {
        // create a per-render id and controller
        const myId = ++renderSeq;
        setCurrentCallId(myId);

        // abort previous render if any (we want only one active controller at a time)
        if (lastAbortController) {
            try {
                lastAbortController.abort();
            } catch { }
        }
        const abortController = new AbortController();
        lastAbortController = abortController;
        const { signal } = abortController;

        // quick bail if no files
        if (!files.length) {
            // Only revoke/set if we're the latest render
            if (myId === renderSeq) {
                if (pngUrl()) URL.revokeObjectURL(pngUrl()!);
                setPngUrl(null);
            }
            return;
        }

        try {
            // Mark busy for this render
            // Only set busy true if this is still the latest render (defensive)
            if (myId === renderSeq) busyStore.setBusy(true);

            const { Midi } = await import("@tonejs/midi/dist/Midi.js");
            if (signal.aborted || myId !== renderSeq) return;

            const buffers = await Promise.all(files.map((f) => f.arrayBuffer()));
            if (signal.aborted || myId !== renderSeq) return;

            const midis = buffers.map((buf) => new Midi(buf));
            if (signal.aborted || myId !== renderSeq) return;

            const rendered = renderMidi(midis[0], args);

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

            // Render SVG to canvas
            const canvas = document.createElement("canvas");
            canvas.width = Number(args.targetWidth ?? args.width);
            canvas.height = Number(args.targetHeight ?? args.height);
            const ctx = canvas.getContext("2d", { willReadFrequently: false })!;
            const v = await Canvg.from(ctx, svg);
            if (signal.aborted || myId !== renderSeq) return;
            await v.render();
            if (signal.aborted || myId !== renderSeq) return;

            // Convert canvas to blob
            const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, "image/png")
            );
            if (signal.aborted || myId !== renderSeq) return;

            if (blob) {
                // Only the latest render may set the URL
                if (myId === renderSeq) {
                    // revoke previous URL (prevent leaks)
                    if (pngUrl()) {
                        try {
                            URL.revokeObjectURL(pngUrl()!);
                        } catch { }
                    }
                    const url = URL.createObjectURL(blob);
                    setPngUrl(url);
                } else {
                    // Not latest: revoke blob URL immediately to avoid leak
                    // (we created no URL, but if we had, revoke it)
                }
            }
        } catch (err: any) {
            // if aborted, ignore; otherwise log
            if (err?.name !== "AbortError") console.error("Render failed:", err);
        } finally {
            // only the latest render should clear busy flag so we don't prematurely stop busy while a newer render is still running
            if (myId === renderSeq) busyStore.setBusy(false);

            // If this controller is still the lastAbortController, clear it
            if (lastAbortController === abortController) lastAbortController = null;
        }
    }, 300);

    // If component unmounts: abort any in-flight render and revoke URL
    onCleanup(() => {
        try {
            if (lastAbortController) lastAbortController.abort();
        } catch { }
        if (pngUrl()) {
            try {
                URL.revokeObjectURL(pngUrl()!);
            } catch { }
        }

        // If just-debounce provides a cancel, call it defensively
        // (just-debounce doesn't guarantee an API, so guard)
        try {
            // @ts-ignore - some debounce implementations provide cancel
            debouncedRender.cancel?.();
        } catch { }
    });

    // watch props and trigger debounced render
    createEffect(() => {
        const { midiFiles, args } = props;

        // if no files: clear existing url (only if there's one)
        if (!midiFiles.length) {
            if (pngUrl()) {
                try {
                    URL.revokeObjectURL(pngUrl()!);
                } catch { }
            }
            setPngUrl(null);
            return;
        }

        // avoid redundant renders if nothing meaningful changed
        if (!propsChanged(midiFiles, args)) return;

        // store lastProps as plain data for future diffing (this is ok — you're not spreading props into reactive state)
        lastProps = {
            files: midiFiles.map((f) => f.name),
            args: { ...args },
        };

        // call debounced render
        debouncedRender(midiFiles, args);
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
                <fieldset
                    style="display:flex; padding: 2rem; justify-content:center;"
                    class={busyStore.busy ? "busy" : ""}
                >
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
