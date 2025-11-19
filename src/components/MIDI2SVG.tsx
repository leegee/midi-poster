import { createEffect, createSignal, Show } from "solid-js";
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
    let abortController: AbortController | null = null;

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
            if (args[key as keyof typeof args] !== lastArgs[key]) return true;
        }
        return false;
    };

    const debouncedRender = debounce(async (files: File[], args: Props["args"]) => {
        if (!files.length) {
            if (pngUrl()) URL.revokeObjectURL(pngUrl()!);
            return setPngUrl(null);
        }

        // cancel any previous render
        abortController?.abort();
        abortController = new AbortController();
        const { signal } = abortController;

        try {
            busyStore.setBusy(true);

            const { Midi } = await import("@tonejs/midi/dist/Midi.js");
            if (signal.aborted) return;

            const buffers = await Promise.all(files.map((f) => f.arrayBuffer()));
            const midis = buffers.map((buf) => new Midi(buf));
            if (signal.aborted) return;

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
            if (signal.aborted) return;

            // --- future-friendly: can move this block into a worker later ---
            const canvas = document.createElement("canvas");
            canvas.width = Number(args.targetWidth ?? args.width);
            canvas.height = Number(args.targetHeight ?? args.height);
            const ctx = canvas.getContext("2d", { willReadFrequently: false })!;
            const v = await Canvg.from(ctx, svg);

            if (signal.aborted) return;
            await v.render();

            if (signal.aborted) return;

            const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, "image/png")
            );
            if (signal.aborted) return;

            if (blob) {
                // revoke previous URL to prevent memory leaks
                if (pngUrl()) URL.revokeObjectURL(pngUrl()!);
                const url = URL.createObjectURL(blob);
                setPngUrl(url);
            }
        } catch (err: any) {
            if (err.name !== "AbortError") console.error("Render failed:", err);
        } finally {
            busyStore.setBusy(false);
        }
    }, 300); // slightly increased to avoid rapid retriggers

    createEffect(() => {
        const { midiFiles, args } = props;
        if (!midiFiles.length) return setPngUrl(null);
        if (args.calls < currentCallId()) return;
        if (!propsChanged(midiFiles, args)) return;

        lastProps = {
            files: midiFiles.map((f) => f.name),
            args: { ...args },
        };

        setCurrentCallId(args.calls);
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
                            width: props.args.targetWidth
                                ? `${props.args.targetWidth}px`
                                : "auto",
                            height: props.args.targetHeight
                                ? `${props.args.targetHeight}px`
                                : "auto",
                            "image-rendering": "crisp-edges",
                        }}
                    />
                </fieldset>
            </Show>
        </Show>
    );
}
