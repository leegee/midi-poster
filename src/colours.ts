
export const NAME_TO_FAMILY: [RegExp, string][] = [
    [/^(flauti|flute)/i, "flute"],
    [/^(oboi|oboe)/i, "oboe"],
    [/^(clarinetti|clarinet)/i, "clarinet"],
    [/^(fagotti|bassoon)/i, "bassoon"],
    [/^(corni|horn)/i, "horn"],
    [/^(trombe|trumpet)/i, "trumpet"],
    [/^(timpani|percussion)/i, "timpani"],
    [/^(violini|violin)/i, "violin"],
    [/^(viole|viola)/i, "viola"],
    [/^(violoncelli|violoncello|cello)/i, "cello"],
    [/^(contrabassi|double bass)/i, "bass"],
    [/^(pizzicato strings)/i, "pizzicato"],
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
    timpani: "hsl(59, 90%, 50%)",
    cymbals: "hsl(50,60%,90%)",

    // Keyboard / synth
    piano: "hsl(0,0%,45%)",
    synth: "hsl(270,40%,60%)",

    default: "hsl(0,0%,55%)",
};
