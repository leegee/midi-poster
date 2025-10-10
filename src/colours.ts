export const NAME_TO_FAMILY: [RegExp, string][] = [
    // Woodwinds
    [/^(flauti|flute)/i, "flute"],
    [/^(oboi|oboe)/i, "oboe"],
    [/^(clarinetti|clarinet)/i, "clarinet"],
    [/^(fagotti|bassoon)/i, "bassoon"],

    // Brass
    [/^(corni|horn)/i, "horn"],
    [/^(trombe|trumpet)/i, "trumpet"],
    [/^(trombone)/i, "trombone"],

    // Percussion
    [/^(timpani|percussion)/i, "timpani"],
    [/^(cymbals|sizzle)/i, "cymbals"],

    // Strings
    [/^(violini|violin)/i, "violin"],
    [/^(viole|viola)/i, "viola"],
    [/^(violoncelli|violoncello|cello|celli)/i, "cello"],
    [/^(contrabassi|double bass)/i, "bass"],
    [/^(pizzicato strings)/i, "pizzicato"],

    // Keyboard / Synth
    [/^(synthstrings 1|synth|pad)/i, "synth"],
    [/^(acoustic grand piano|piano)/i, "piano"],
];

export const FAMILY_COLOR: Record<string, string> = {
    // Woodwinds
    flute: "hsla(200,70%,70%, 0.9)",
    oboe: "hsla(210,60%,55%, 0.9)",
    clarinet: "hsla(180,30%,65%, 0.9)",
    bassoon: "hsla(190,50%,45%, 0.9)",

    // Brass
    horn: "hsl(40,70%,55%)",
    trumpet: "hsl(50,70%,60%)",
    trombone: "hsl(35,60%,50%)",

    // Strings
    violin: "hsla(120,70%,75%,.7)",
    viola: "hsla(130,70%,70%,.8)",
    cello: "hsla(140,70%,60%,.9)",
    bass: "hsla(130, 70%, 50%, 0.9)",
    pizzicato: "hsla(120, 60%, 55%, 0.9)",

    // Percussion
    timpani: "hsla(59, 59.80%, 30.00%, 0.64)",
    cymbals: "hsla(50, 93.30%, 86.50%, 0.50)",

    // Keyboard / Synth
    piano: "hsl(0,0%,45%)",
    synth: "hsl(270,40%,60%)",

    default: "hsl(0,0%,55%)",
};
