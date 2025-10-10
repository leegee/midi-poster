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
    flute: "hsl(200,60%,60%)",
    oboe: "hsl(210,60%,55%)",
    clarinet: "hsl(180,60%,55%)",
    bassoon: "hsl(190,50%,45%)",

    // Brass
    horn: "hsl(40,70%,55%)",
    trumpet: "hsl(50,70%,60%)",
    trombone: "hsl(35,60%,50%)",

    // Strings
    violin: "hsl(120,50%,65%)",
    viola: "hsl(130,50%,60%)",
    cello: "hsl(140,50%,50%)",
    bass: "hsl(150,50%,45%)",
    pizzicato: "hsl(160,50%,55%)",

    // Percussion
    timpani: "hsla(59, 89.80%, 50.00%, 0.64)",
    cymbals: "hsla(50, 93.30%, 76.50%, 0.50)",

    // Keyboard / Synth
    piano: "hsl(0,0%,45%)",
    synth: "hsl(270,40%,60%)",

    default: "hsl(0,0%,55%)",
};
