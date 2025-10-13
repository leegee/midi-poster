import { createEffect, createSignal, Show } from "solid-js";
import { renderMidi, type RenderOptions } from "~/midi/midi-render";
import { createSvg } from "~/midi/midi-row";

type Props = {
    title: string;
    midiFiles: File[];
    args: RenderOptions & { calls: number };
};

export default function MIDI2SVG(props: Props) {
    const [svg, setSvg] = createSignal<string | null>(null);

    createEffect(async () => {
        if (!props.midiFiles.length) return setSvg(null);

        console.log('Call', props.args.calls || 0);

        const { Midi } = await import("@tonejs/midi/dist/Midi.js");
        const buffers = await Promise.all(props.midiFiles.map((f) => f.arrayBuffer()));
        const midis = buffers.map((buf) => new Midi(buf));

        const rendered = renderMidi(midis[0], props.args);
        const svgStr = createSvg([rendered], props.args).svg;
        setSvg(svgStr);
    });

    return (
        <Show when={svg()} fallback={<p>Upload MIDI files to preview</p>}>
            <fieldset style="display:flex; padding: 2rem; justify-content:center;">
                <legend class="large-text code border"><code>{props.title}</code></legend>

                <div innerHTML={svg()!}
                    style={{
                        width: props.args.targetWidth ? `${props.args.targetWidth}px` : "auto",
                        height: props.args.targetHeight ? `${props.args.targetHeight}px` : "auto"
                    }}
                />
            </fieldset>
        </Show>
    );
}
