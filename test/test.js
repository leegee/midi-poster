import fs from "fs";
import fetch from "node-fetch";

const base64 = fs.readFileSync("../midi/5/beethoven_symphony_5_1_(c)galimberti.mid").toString("base64");

const res = await fetch("http://localhost:3000/api/render-png", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ midiArrayBuffer: base64, args: { width: 1000, height: 300 } }),
});

if (!res.ok) {
    console.error(await res.text());
    throw new Error("Render failed");
}

const buffer = await res.arrayBuffer();
fs.writeFileSync("test.png", Buffer.from(buffer));
console.log("Saved test.png");
