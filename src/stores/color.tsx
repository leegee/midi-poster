import { createStore } from "solid-js/store";
import { makePersisted } from "@solid-primitives/storage";
import { DEFAULT_FAMILY_COLOR } from "~/colours";

export const [userFamilyColorStore, setUserFamilyColorStore] = makePersisted(
    createStore<Partial<Record<string, string>>>({}),
    { name: "userFamilyColor" }
);

export function getFamilyColor(family: string) {
    return userFamilyColorStore[family] ?? DEFAULT_FAMILY_COLOR[family] ?? DEFAULT_FAMILY_COLOR.default;
}

export function setFamilyColor(family: string, color: string) {
    setUserFamilyColorStore(family, color);
}
