import { type Midi } from "@tonejs/midi";

export function isTrackMonophonic(track: Midi["tracks"][number]): boolean {
    // Sort notes by start time
    const notes = track.notes.slice().sort((a, b) => a.time - b.time);
    for (let i = 1; i < notes.length; i++) {
        const prevEnd = notes[i - 1].time + notes[i - 1].duration;
        if (notes[i].time < prevEnd) return false; // overlap detected
    }
    return true;
}
