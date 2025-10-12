import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import path from "path";

export default defineConfig({
    plugins: [solid()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        target: "esnext",
        outDir: "dist",
        assetsDir: "assets",
    },
    server: {
        port: 5173,
        open: true,
    },
});
