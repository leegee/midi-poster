import { createEffect, createSignal, Show } from "solid-js";
import { renderMidi, type RenderOptions } from "~/midi/midi-render";
import { createSvg } from "~/midi/midi-row";
import debounce from "just-debounce";
import { busyStore } from "~/stores/busy-store";

type Props = {
    title: string;
    midiFiles: File[];
    args: RenderOptions & { calls: number };
};

export default function MIDI2SVG(props: Props) {
    const [svg, setSvg] = createSignal<string | null>(null);
    const [currentCallId, setCurrentCallId] = createSignal(-1);

    // Debounced render function
    const debouncedRender = debounce(async (files: File[], args: Props["args"]) => {
        if (!files.length) return setSvg(null);

        try {
            busyStore.setBusy(true);
            const { Midi } = await import("@tonejs/midi/dist/Midi.js");
            const buffers = await Promise.all(files.map(f => f.arrayBuffer()));
            const midis = buffers.map(buf => new Midi(buf));
            const rendered = renderMidi(midis[0], args);
            const svgStr = createSvg([rendered], args).svg;
            setSvg(svgStr);
        }
        finally {
            busyStore.setBusy(false);
        }
    }, 200);

    createEffect(() => {
        if (!props.midiFiles.length) return setSvg(null);
        if (props.args.calls < currentCallId()) return;

        setCurrentCallId(props.args.calls);
        debouncedRender(props.midiFiles, props.args);
    });

    return (
        <Show when={svg()} fallback={<p>Upload MIDI files to preview</p>}>
            <Show when={!busyStore.busy} fallback={<p>Rendering...</p>}>
                <fieldset style="display:flex; padding: 2rem; justify-content:center;" class={busyStore.busy ? "busy" : ""}>
                    <legend class="large-text code border">
                        <code>{busyStore.busy ? 'BUILDING' : props.title}</code>
                    </legend>

                    <div innerHTML={svg()!}
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
