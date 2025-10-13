import { createEffect, createSignal, Show } from "solid-js";
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

export default function MIDI2SVG(props: Props) {
    const [svg, setSvg] = createSignal<string | null>(null);
    const [currentCallId, setCurrentCallId] = createSignal(-1);
    let lastProps: { files: string[]; args: any } | null = null;

    const propsChanged = (files: File[], args: Props["args"]) => {
        const fileNames = files.map(f => f.name);
        if (!lastProps) return true;
        if (fileNames.length !== lastProps.files.length) return true;
        for (let i = 0; i < fileNames.length; i++) {
            if (fileNames[i] !== lastProps.files[i]) return true;
        }
        // Shallow compare args (fine for primitives)
        const argKeys = Object.keys(args);
        const lastArgs = lastProps.args;
        if (argKeys.length !== Object.keys(lastArgs).length) return true;
        for (const key of argKeys) {
            if (args[key as keyof typeof args] !== lastArgs[key]) return true;
        }
        return false;
    };

    const debouncedRender = debounce(async (files: File[], args: Props["args"]) => {
        if (!files.length) return setSvg(null);

        try {
            busyStore.setBusy(true);
            const { Midi } = await import("@tonejs/midi/dist/Midi.js");
            const buffers = await Promise.all(files.map(f => f.arrayBuffer()));
            const midis = buffers.map(buf => new Midi(buf));
            const rendered = renderMidi(midis[0], args);

            if (rendered.density && rendered.densityMeta) {
                rendered.features = extractDensityFeatures(
                    rendered.density,
                    rendered.densityMeta,
                    rendered.width,
                    rendered.height,
                    5 // top N features
                );
            }

            const svgStr = createSvg([rendered], args).svg;
            setSvg(svgStr);
        } finally {
            busyStore.setBusy(false);
        }
    }, 200);

    createEffect(() => {
        const { midiFiles, args } = props;

        if (!midiFiles.length) return setSvg(null);
        if (args.calls < currentCallId()) return;

        // Skip if nothing actually changed
        if (!propsChanged(midiFiles, args)) return;

        // Remember last props snapshot
        lastProps = {
            files: midiFiles.map(f => f.name),
            args: { ...args }
        };

        setCurrentCallId(args.calls);
        debouncedRender(midiFiles, args);
    });

    return (
        <Show when={svg()} fallback={<p>Upload MIDI files to preview</p>}>
            <Show when={!busyStore.busy} fallback={<p>Rendering...</p>}>
                <fieldset
                    style="display:flex; padding: 2rem; justify-content:center;"
                    class={busyStore.busy ? "busy" : ""}
                >
                    <legend class="large-text code border">
                        <code>{busyStore.busy ? "BUILDING" : props.title}</code>
                    </legend>

                    <div
                        innerHTML={svg()!}
                        style={{
                            width: props.args.targetWidth ? `${props.args.targetWidth}px` : "auto",
                            height: props.args.targetHeight ? `${props.args.targetHeight}px` : "auto"
                        }}
                    />
                </fieldset>
            </Show>
        </Show>
    );
}
