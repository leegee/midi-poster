import { createStore } from "solid-js/store";

type BusyStore = {
    busy: boolean;
    setBusy: (value: boolean) => void;
};

// Create a simple store with getter/setter
const [store, setStore] = createStore<{ busy: boolean }>({ busy: false });

export const busyStore: BusyStore = {
    get busy() {
        return store.busy;
    },
    setBusy(value: boolean) {
        setStore({ busy: value });
    },
};
