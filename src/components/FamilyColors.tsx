import { For } from "solid-js";
import { setFamilyColor, getFamilyColor } from "~/stores/color";
import ColorPicker from "./ColorPicker";
import { colorFamilies } from "~/colours";

export default function FamilyColorEditor() {

    return (
        <section>
            <For each={colorFamilies}>
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
