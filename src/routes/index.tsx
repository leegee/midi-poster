import './index.css';
import { createSignal, Show, For, JSX, createEffect } from "solid-js";
import { arrayBufferToBase64 } from '../lib/arrayBufferToBase64';

import MIDI2SVG from "~/components/MIDI2SVG";
import { RenderOptions } from "~/midi/midi-render";
import { busyStore } from "~/stores/busy-store";
import FamilyColorEditor from "~/components/FamilyColors";

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
  const [activeTab, setActiveTab] = createSignal("overview");

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
    renderFeatures: false,
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
      <nav class={"left controls left-margin " + (busyStore.busy ? " busy " : "")}>
        <header>
          <nav>
            <button class={"small circle " + (midiFiles().length > 0 ? 'transparent' : '')}>
              <i>attach_file</i>
              <input type="file" multiple accept=".mid" onChange={handleFiles} />
              <div class="tooltip bottom">Add one or more MIDI files</div>
            </button>

            <div class="group">
              <button class={"small no-margin left-round " + (activeTab() === "overview" ? "" : "border")}
                onClick={() => setActiveTab("overview")}
              >
                <i>info</i>
                <div class="tooltip bottom">Overview</div>
              </button>

              <button class={"small no-margin right-round " + (activeTab() === "colors" ? "" : "border")}
                onClick={() => setActiveTab("colors")}
              >
                <i>palette</i>
                <div class="tooltip bottom">Colours</div>
              </button>
            </div>

            <Show when={midiFiles().length > 0}>
              <div class="group">
                <button class="small no-margin left-round" onClick={() => args().calls ? args().calls++ : args().calls = 0}>
                  <i>autorenew</i>
                  <div class="tooltip bottom">Force a re-render</div>
                </button>
                <button class="small no-margin right-round" onClick={renderServerPngs}>
                  <i>download</i>
                  <div class="tooltip bottom">Download PNGs</div>
                </button>
              </div>
            </Show>
          </nav>

          <Show when={pngUrls().length}>
            <section class="border padding thumbnail-grid">
              <For each={pngUrls()}>
                {(url, i) => (
                  <>
                    <a href={url} download={`render_${i() + 1}.png`} class="thumbnail-link">
                      <img src={url} alt={`Render ${i() + 1}`} class="thumbnail-img border" />
                    </a>
                    <div class="tooltip">Click to download</div>
                  </>
                )}
              </For>
            </section>
          </Show>
          {/* 
          <div>
            <button class={"no-margin left-round " + (activeTab() === "overview" ? "fill" : "border")}
              onClick={() => setActiveTab("overview")}
            >
              <i>info</i>
              <span>Overview</span>
            </button>
            <button class={"no-margin right-round " + (activeTab() === "colors" ? "fill" : "border")}
              onClick={() => setActiveTab("colors")}
            >
              <i>palette</i>
              <span>Colours</span>
            </button>
          </div> */}
        </header>

        <div class="scroll border no-padding no-margin" style="height: 80vh">
          <div id="overview" class={`page padding ${activeTab() === "overview" ? "active" : ""}`}>
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
                  <label>Blur</label>
                  <div class="tooltip">Gaussian blur standard diviation</div>
                  <input type="number" class="input border no-padding"
                    value={args().blur} disabled={!args().softNotes}
                    onBlur={e => updateArg("blur", +e.currentTarget.value)}
                  />
                </div>

                <div class="field">
                  <label>Soft Factor</label>
                  <div class="tooltip">Soft note factor</div>
                  <input type="number" class="input border no-padding"
                    value={args().softNoteFactor} disabled={!args().softNotes}
                    onBlur={e => updateArg("softNoteFactor", +e.currentTarget.value)}
                  />
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

                <div class="field">
                  <nav>
                    <label class="max">
                      <p>Render features</p>
                    </label>
                    <div class="tooltip right">Render mystery features</div>
                    <label class="switch">
                      <input type="checkbox"
                        checked={args().renderFeatures}
                        onChange={e => updateArg("renderFeatures", e.currentTarget.checked)}
                      />
                      <span></span>
                    </label>
                  </nav>
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
          </div>

          <div id="colors" class={`page padding ${activeTab() === "colors" ? "active" : ""}`}>
            <FamilyColorEditor />
          </div>

        </div>
      </nav>

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
