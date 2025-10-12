import { createSignal, Show, For, JSX } from "solid-js";
import { arrayBufferToBase64 } from '../lib/arrayBufferToBase64';
import './index.css';

import MIDI2SVG from "~/components/MIDI2SVG";
import { RenderOptions } from "~/midi/midi-render";

export default function Home() {
  const [midiFiles, setMidiFiles] = createSignal<File[]>([]);
  const [pngUrls, setPngUrls] = createSignal<string[]>([]);
  const [args, setArgs] = createSignal<RenderOptions & { calls: number }>({
    calls: 0,
    xOffset: 0,
    pitchRange: [0, 127],
    width: 1000,
    height: 300,
    targetWidth: 1000,
    targetHeight: 300,
    reverbIntensity: 1,
    softNotes: false,
    softNoteFactor: 3,
    noteScaleFactor: 1,
    minNoteHeight: 1.5,
    velocityScaledHeight: true,
    blendMode: "normal",
    densityScaleFactor: 10,
    blur: 2,
    double: false,
    background: "#222255",
  });

  const handleFiles: JSX.ChangeEventHandler<HTMLInputElement, Event> = (e) => {
    const files = e.currentTarget.files;
    if (files) setMidiFiles([...files]);
  };

  const renderServerPngs = async () => {
    const files = midiFiles();
    if (!files.length) return;
    setPngUrls([]);

    const urls = await Promise.all(
      files.map(async (file) => {
        const buf = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(buf);

        const res = await fetch("/api/render-png", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ midiArrayBuffer: base64, args: args(), fileName: file.name }),
        });

        if (!res.ok) throw new Error(`Render failed for ${file.name}`);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      })
    );

    setPngUrls(urls);
  };

  const updateArg = <K extends keyof RenderOptions>(key: K, value: RenderOptions[K]) => {
    setArgs({ ...args(), [key]: value });
  };

  return (
    <>
      <nav class="left" style={{ width: 'clamp(240pt,20vw,420px)', padding: '0.5rem' }}>
        <fieldset class="tiny-padding">
          <button class="small">
            <i>attach_file</i>
            <span>MIDI File(s)</span>
            <input type="file" multiple accept=".mid" onChange={handleFiles} />
          </button>

          <Show when={midiFiles().length > 0}>
            <button class="small circle" onClick={() => args().calls ? args().calls++ : args().calls = 0}>
              <i>autorenew</i>
            </button>
            <button class="small circle" onClick={renderServerPngs}>▼</button>
          </Show>
        </fieldset>

        {/* Dimensions */}
        <fieldset class="tiny-padding border">
          <legend>Dimensions</legend>
          <div class="paired-row">
            <div class="field">
              <label>Width</label>
              <input type="number" class="input"
                value={args().width}
                onBlur={e => updateArg("width", +e.currentTarget.value)}
              />
            </div>
            <div class="field">
              <label>Height</label>
              <input type="number" class="input"
                value={args().height}
                onBlur={e => updateArg("height", +e.currentTarget.value)}
              />
            </div>
          </div>
          <div class="paired-row">
            <div class="field">
              <label>Target Width</label>
              <input type="number" class="input"
                value={args().targetWidth}
                onBlur={e => updateArg("targetWidth", +e.currentTarget.value)}
              />
            </div>
            <div class="field">
              <label>Target Height</label>
              <input type="number" class="input"
                value={args().targetHeight}
                onBlur={e => updateArg("targetHeight", +e.currentTarget.value)}
              />
            </div>
          </div>
        </fieldset>

        {/* Notes */}
        <fieldset class="tiny-padding border">
          <legend>Notes</legend>
          <div class="switch-field">
            <label class="switch">
              <input type="checkbox"
                checked={args().softNotes}
                onChange={e => updateArg("softNotes", e.currentTarget.checked)}
              />
              <span>Soft Notes</span>
            </label>
          </div>

          <div class="paired-row">
            <div class="field">
              <label>Soft Note Factor</label>
              <input type="number" class="input"
                value={args().softNoteFactor}
                onBlur={e => updateArg("softNoteFactor", +e.currentTarget.value)}
              />
            </div>
            <div class="field">
              <label>Note Scale Factor</label>
              <input type="number" class="input"
                value={args().noteScaleFactor}
                onBlur={e => updateArg("noteScaleFactor", +e.currentTarget.value)}
              />
            </div>
          </div>

          <div class="paired-row">
            <div class="field">
              <label>Min Note Height</label>
              <input type="number" class="input" min={0} max={1000}
                value={args().minNoteHeight}
                onBlur={e => updateArg("minNoteHeight", +e.currentTarget.value)}
              />
            </div>

            <div class="field middle-align extra-padding top-padding">
              <nav>
                <div class="max">
                  <p>Velocity Scaled Height</p>
                </div>
                <label class="switch">
                  <input type="checkbox"
                    checked={args().velocityScaledHeight}
                    onChange={e => updateArg("velocityScaledHeight", e.currentTarget.checked)}
                  />
                  <span></span>
                </label>
              </nav>
            </div>
          </div>

        </fieldset>

        {/* Density & Effects */}
        <fieldset class="tiny-padding border">
          <legend>Density & Effects</legend>
          <div class="paired-row">
            <div class="field">
              <label>Density Scale Factor</label>
              <input type="number" class="input"
                value={args().densityScaleFactor}
                onBlur={e => updateArg("densityScaleFactor", +e.currentTarget.value)}
              />
            </div>
            <div class="field">
              <label>Reverb Intensity</label>
              <input type="range" class="range" min="0" max="5" step="0.1"
                value={args().reverbIntensity}
                onBlur={e => updateArg("reverbIntensity", +e.currentTarget.value)}
              />
            </div>
          </div>

          <div class="paired-row">
            <div class="field">
              <label>Blur</label>
              <input type="number" class="input"
                value={args().blur}
                onBlur={e => updateArg("blur", +e.currentTarget.value)}
              />
            </div>
            <div class="field">
              <label>Blend Mode</label>
              <input type="text" class="input"
                value={args().blendMode}
                onBlur={e => updateArg("blendMode", e.currentTarget.value)}
              />
            </div>
          </div>

          <div class="field border tiny-padding middle-align center-align" style={`background-color:${args().background}`}>
            <label>Background</label>
            <input type="color" class="input"
              value={args().background}
              onBlur={e => updateArg("background", e.currentTarget.value)}
            />
          </div>

          <div class="switch-field">
            <label class="switch">
              <input type="checkbox"
                checked={args().double}
                onChange={e => updateArg("double", e.currentTarget.checked)}
              />
              <span>Double Render</span>
            </label>
          </div>
        </fieldset>
      </nav>

      <main class="responsive">
        <Show when={midiFiles().length > 0}>
          <For each={midiFiles()}>
            {(file) => (
              <section class="border padding">
                <span class="large-text"><code>{file.name}</code></span>
                <MIDI2SVG midiFiles={[file]} args={args()} />

                <Show when={pngUrls().length}>
                  <div class="thumbnail-grid">
                    <For each={pngUrls()}>
                      {(url, i) => (
                        <a href={url} download={`render_${i() + 1}.png`} class="thumbnail-link">
                          <img src={url} alt={`Render ${i() + 1}`} class="thumbnail-img border" />
                        </a>
                      )}
                    </For>
                  </div>
                </Show>

              </section>
            )}
          </For>
        </Show>
      </main>
    </>
  );
}
