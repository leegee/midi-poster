const NAME_TO_FAMILY: [RegExp, string][] = [
    // Woodwinds
    [/^(piccolo)/i, "piccolo"],
    [/^(flauti|flute|ottavino)/i, "flute"],
    [/^(oboi|oboe)/i, "oboe"],
    [/^(clarin)/i, "clarinet"],
    [/^(fagotti|bassoon)/i, "bassoon"],
    [/^(contra-?fagot|contro)/i, "contraBassoon"],

    // Brass
    [/^(corni|horn)/i, "horn"],
    [/^(trombe|trumpet)/i, "trumpet"],
    [/^(trombone|tromboni)/i, "trombone"], // Contrafagot

    // Percussion
    [/^(timpani|percussion)/i, "timpani"],
    [/^(piatti|cymbals|sizzle)/i, "cymbals"],

    // Strings
    [/^(violini|violin)/i, "violin"],
    [/^(viole|viola)/i, "viola"],
    [/^(violoncelli|violoncello|cello|celli)/i, "cello"],
    [/^(contrabassi|double bass|bass)/i, "bass"],
    [/^(pizzicato strings)/i, "pizzicato"],
    [/^(tremolo strings)/i, "violin"],

    // Voice
    [/^(soprano)/i, "soprano"],
    [/^(alto)/i, "alto"],
    [/^(tenor)/i, "tenor"],
    [/^(baritone)/i, "baritone"],
    [/^(bass)/i, "bassVoice"],

    // Keyboard / Synth
    [/^(synthstrings 1|synth|pad)/i, "synth"],
    [/^(acoustic grand piano|piano)/i, "piano"],
];

const DEFAULT_FAMILY_COLOR: Record<string, string> = {
    // Woodwinds
    piccolo: "hsla(180,70%,60%, 0.9)",
    flute: "hsla(200,70%,70%, 0.9)",
    oboe: "hsla(210,60%,55%, 0.9)",
    clarinet: "hsla(140,50%,65%, 0.9)",
    bassoon: "hsla(190,70%,45%, 0.9)",
    contraBassoon: "hsla(190,70%,35%, 0.9)",

    // Brass
    horn: "hsla(40,80%,55%, 1)",
    trumpet: "hsla(50,80%,60%, 1)",
    trombone: "hsla(35,70%,60%, 1)",

    // Strings
    violin: "hsla(120,70%,75%,.7)",
    viola: "hsla(130,70%,70%,.8)",
    cello: "hsla(140,70%,60%,.9)",
    bass: "hsla(130, 70%, 50%, 0.9)",
    pizzicato: "hsla(120, 60%, 55%, 0.9)",

    // Percussion
    timpani: "hsla(261, 60%, 40%, 0.2)",
    cymbals: "hsla(50, 100%, 64%, 0.89)",

    // Keyboard / Synth
    piano: "hsl(0,0%,45%)",
    synth: "hsl(270,40%,60%)",

    // Voice
    soprano: "hsl(200,50%,50%)",
    alto: "hsl(140,50%,50%)",
    tenor: "hsl(70,50%,50%)",
    baritone: "hsl(30,50%,50%)",
    bassVoice: "hsl(2,60%,50%)",

    default: "hsl(0,0%,55%)",
};

export function trackNameToFamily(name: string) {
    for (const [re, family] of NAME_TO_FAMILY) {
        if (re.test(name)) return family;
    }
    console.warn("Unmapped track:", name);
    return "default";
}

export let userFamilyColor: Partial<Record<string, string>> = {};

export function getFamilyColor(family: string) {
    return userFamilyColor[family] ?? DEFAULT_FAMILY_COLOR[family] ?? DEFAULT_FAMILY_COLOR.default;
}
