import { createEffect, createSignal, Show } from "solid-js";

import { renderMidi, type RenderOptions } from "~/midi/midi-render";
import { buildSvgRow } from "~/midi/midi-row";

type Props = {
    midiFiles: File[];
    args: RenderOptions;
};

export default function MidiPreview(props: Props) {
    const [svg, setSvg] = createSignal<string | null>(null);

    createEffect(async () => {
        if (!props.midiFiles.length) return setSvg(null);

        const { Midi } = await import("@tonejs/midi/dist/Midi.js");
        const buffers = await Promise.all(props.midiFiles.map(f => f.arrayBuffer()));
        const midis = buffers.map(buf => new Midi(buf));

        const rendered = renderMidi(midis[0], props.args);
        const svgStr = buildSvgRow([rendered], props.args).svg;
        setSvg(svgStr);
    });


    return (
        <Show when={svg()} fallback={<p>Upload MIDI files to preview</p>}>
            <div innerHTML={svg()!} />
        </Show>
    );
}
