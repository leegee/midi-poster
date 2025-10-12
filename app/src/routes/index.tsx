import { createSignal, Show, JSX } from "solid-js";
import MidiPreview from "~/components/MidiPreview";

export default function Home() {
  const [midiFiles, setMidiFiles] = createSignal<File[]>([]);
  const [pngObjectUrl, setPngObjectUrl] = createSignal<string | null>(null);
  const [args, setArgs] = createSignal({
    reverbIntensity: 1,
    blur: 2,
    background: "#fff",
  });

  const handleFiles: JSX.ChangeEventHandler<HTMLInputElement, Event> = (e) => {
    alert('welcome')
    const files = e.currentTarget.files;
    console.log("Files picked:", files);
    if (files) setMidiFiles([...files]);
  };

  const renderServerPng = async () => {
    if (!midiFiles().length) return;

    const buf = await midiFiles()[0].arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));

    const res = await fetch("/api/render-png", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        midiArrayBuffer: base64,
        args,
      }),
    });

    if (!res.ok) throw new Error("Render failed");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    setPngObjectUrl(url);
  }

  return (
    <>
      <nav class="bottom">
        <button class="large">
          <i>attach_file</i>
          <span>MIDI File(s)</span>
          <input type="file" multiple accept=".mid" onChange={(e) => { alert('oh'); handleFiles(e) }} />
        </button>

        <button onClick={renderServerPng}>Render PNG (Server)</button>
        <a href={pngObjectUrl()!} download="render.png">Download PNG</a>

      </nav>
      <main class="responsive">
        <Show when={midiFiles().length > 0}>
          <MidiPreview midiFiles={midiFiles()} args={args()} />
        </Show>
      </main >
    </>
  );
}
