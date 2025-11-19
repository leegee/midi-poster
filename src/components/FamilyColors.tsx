import { For } from "solid-js";
import { DEFAULT_FAMILY_COLOR, } from "~/colours";
import { setFamilyColor, getFamilyColor } from "~/stores/color";
import ColorPicker from "./ColorPicker";

export default function FamilyColorEditor() {
    const families = Object.keys(DEFAULT_FAMILY_COLOR);

    return (
        <section>
            <For each={families}>
                {(family) => (
                    <ColorPicker
                        label={family}
                        value={getFamilyColor(family)}
                        onChange={(value: string) => setFamilyColor(family, value)}
                    />
                )}
            </For>
        </section>
    );
}
