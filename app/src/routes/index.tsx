import { createSignal, Show, For, JSX } from "solid-js";
import { arrayBufferToBase64 } from '../lib/arrayBufferToBase64';
import './index.css';

import MIDI2SVG from "~/components/MIDI2SVG";
import { RenderOptions } from "~/midi/midi-render";

const TIME_DIVISIONS = [
  { label: "1/16", value: 1 / 16 },
  { label: "1/8", value: 1 / 8 },
  { label: "1/4", value: 1 / 4 },
  { label: "1/2", value: 1 / 2 },
  { label: "1", value: 1 },
  { label: "2/1", value: 2 },
  { label: "4/1", value: 4 },
  { label: "8/1", value: 8 },
  { label: "16/1", value: 16 },
];

const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "soft-light",
  "hard-light",
  "color-burn",
  "color-dodge",
  "difference",
  "exclusion",
  "lighten",
  "darken",
];

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
    noteHeightScaleFactor: 1,
    noteWidthScaleFactor: 1,
    minNoteHeight: 1.5,
    velocityScaledHeight: true,
    blendMode: "normal",
    densityScaleFactor: 10,
    densityTimeDivision: 4,
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
      <nav class="left controls" style={{ width: 'clamp(240pt,20vw,420px)', padding: '0.5rem' }}>
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


        <section>
          <Show when={pngUrls().length}>
            <div class="border padding thumbnail-grid">
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


        {/* Dimensions */}
        <fieldset class="tiny-padding border">
          <legend>Processing Dimensions</legend>
          <div class="paired-row">
            <div class="field">
              <label>Width</label>
              <input type="number" class="input border no-padding"
                value={args().width}
                onBlur={e => updateArg("width", +e.currentTarget.value)}
              />
            </div>
            <div class="field">
              <label>Height</label>
              <input type="number" class="input border no-padding"
                value={args().height}
                onBlur={e => updateArg("height", +e.currentTarget.value)}
              />
            </div>
          </div>
        </fieldset>

        <fieldset class="tiny-padding border">
          <legend>Target Dimensions</legend>
          <div class="paired-row">
            <div class="field">
              <label>Width</label>
              <input type="number" class="input border no-padding"
                value={args().targetWidth}
                onBlur={e => updateArg("targetWidth", +e.currentTarget.value)}
              />
            </div>
            <div class="field">
              <label>Height</label>
              <input type="number" class="input border no-padding"
                value={args().targetHeight}
                onBlur={e => updateArg("targetHeight", +e.currentTarget.value)}
              />
            </div>
          </div>
        </fieldset>

        {/* Notes */}
        <fieldset class="tiny-padding border">
          <legend>Notes</legend>
          <div class="paired-row">
            <div class="field">
              <label>Soft Factor</label>
              <div class="tooltip">Soft note factor</div>

              <input type="number" class="input border no-padding"
                value={args().softNoteFactor}
                onBlur={e => updateArg("softNoteFactor", +e.currentTarget.value)}
              />
            </div>

            <div class="field">
              <nav>
                <label class="max">
                  <p>Soft notes</p>
                </label>
                <div class="tooltip right">Softens blocks with fuzzy edges</div>
                <label class="switch">
                  <input type="checkbox"
                    checked={args().softNotes}
                    onChange={e => updateArg("softNotes", e.currentTarget.checked)}
                  />
                  <span></span>
                </label>
              </nav>
            </div>

          </div>

          <div class="paired-row">
            <div class="field">
              <label>Scale Width</label>
              <div class="tooltip">Note scale factor</div>
              <input type="number" class="input border no-padding"
                value={args().noteWidthScaleFactor}
                onBlur={e => updateArg("noteWidthScaleFactor", +e.currentTarget.value)}
              />
            </div>
            <div class="field">
              <label>Scale Height</label>
              <div class="tooltip">Note scale factor</div>
              <input type="number" class="input border no-padding"
                value={args().noteHeightScaleFactor}
                onBlur={e => updateArg("noteHeightScaleFactor", +e.currentTarget.value)}
              />
            </div>
          </div>

          <div class="paired-row">
            <div class="field">
              <label>Min Note Height</label>
              <div class="tooltip">Minimum note height</div>

              <input type="number" class="input border no-padding" min={0} max={1000}
                value={args().minNoteHeight}
                onBlur={e => updateArg("minNoteHeight", +e.currentTarget.value)}
              />
            </div>

            <div class="field">
              <nav>
                <label class="max">
                  <p>Velocity Scales Height</p>
                </label>
                <div class="tooltip right">Normalised across what I don't recall</div>
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
              <label>Density Scale</label>
              <div class="tooltip">Scale up the size of notes by their cluster density</div>
              <input type="number" class="input border no-padding"
                value={args().densityScaleFactor}
                onBlur={e => updateArg("densityScaleFactor", +e.currentTarget.value)}
              />
            </div>

            <div class="field border">
              <div class="field middle-align">
                <label class="slider border">
                  <input type="range" min="0" max="5" step="0.1"
                    value={args().reverbIntensity}
                    onBlur={e => updateArg("reverbIntensity", +e.currentTarget.value)}
                  />
                  <span></span>
                </label>
                <span class="helper">Reverb Intensity</span>
              </div>

            </div>
          </div>

          <div class="paired-row">
            <div class="field">
              <label>Blur</label>
              <input type="number" class="input border no-padding"
                value={args().blur}
                onBlur={e => updateArg("blur", +e.currentTarget.value)}
              />
            </div>

            <div class="field">
              <label>Time Division</label>
              <div class="tooltip">Fraction of a beat per density cell (eg 0.25 = 16th note)</div>
              <select
                value={args().densityTimeDivision}
                onChange={(e) => setArgs({ ...args(), densityTimeDivision: parseFloat(e.currentTarget.value) })}
              >
                {TIME_DIVISIONS.map((d) => (
                  <option value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div class="paired-row">
            <div class="field tiny-margin border label">
              <div class="tooltip right">Such as "normal," "multiply," or "screen." </div>
              <select
                value={args().blendMode}
                onChange={(e) => setArgs({ ...args(), blendMode: e.currentTarget.value })}
              >
                {BLEND_MODES.map((mode) => (
                  <option value={mode}>{mode}</option>
                ))}
              </select>
              <label>Blend Mode</label>
            </div>

            <div class="field">
              <nav>
                <label class="max">
                  <p>Double Render</p>
                </label>
                <div class="tooltip right">Render two versions at once...mysterious</div>
                <label class="switch">
                  <input type="checkbox"
                    checked={args().double}
                    onChange={e => updateArg("double", e.currentTarget.checked)}
                  />
                  <span></span>
                </label>
              </nav>
            </div>

          </div>

          <div class="elevate field border no-padding middle-align center-align no-bottom-margin no-top-margin" style={`background-color:${args().background}`}>
            <nav>
              <input type="color" class="input"
                value={args().background}
                onBlur={e => updateArg("background", e.currentTarget.value)}
              />
              <button class="circle transparent">
                <i>palette</i>
              </button>
              <h5 class="max">Background</h5>
            </nav>
          </div>

        </fieldset>
      </nav >

      <main class="responsive">
        <Show when={midiFiles().length > 0}>
          <For each={midiFiles()}>
            {(file) => (
              <section class="padding">
                <MIDI2SVG midiFiles={[file]} title={file.name} args={args()} />
              </section>
            )}
          </For>

        </Show>
      </main>
    </>
  );
}
