import { For } from "solid-js";
import { DEFAULT_FAMILY_COLOR, } from "~/colours";
import { setFamilyColor, getFamilyColor } from "~/stores/color";
import ColorPicker from "./ColorPicker";

export default function FamilyColorEditor() {
    const families = Object.keys(DEFAULT_FAMILY_COLOR);

    return (
        <div style="display: flex; flex-direction: column; gap: 0.6em">
            <For each={families}>
                {(family) => (
                    <div style="display: flex; align-items: left; gap: 0.6em;">

                        {/*
                        <div
                            style={`
                            width: 2em;
                            height: 1em;
                            background: ${getFamilyColor(family)};
                            border: 1px solid #000;
                        `}
                        />

                        <label style="flex: 1;">{family}</label>

                         <input
                            type="color"
                            value={getFamilyColor(family)}
                            onInput={(e) => setFamilyColor(family, (e.target as HTMLInputElement).value)}
                        /> */}

                        <ColorPicker
                            label={family}
                            value={getFamilyColor(family)}
                            onChange={(value: string) => setFamilyColor(family, value)}
                        />

                    </div>
                )}
            </For>
        </div>
    );
}
