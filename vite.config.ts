import { defineConfig, searchForWorkspaceRoot } from "vite";
import solid from "vite-plugin-solid";
import path from "path";

export default defineConfig({
    plugins: [solid()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        }
    },
    build: {
        target: "esnext",
        outDir: "dist",
        assetsDir: "assets",
    },
    server: {
        port: 5173,
        open: true,
        fs: {
            allow: [
                searchForWorkspaceRoot(process.cwd()),
                path.resolve(__dirname, 'node_modules/beercss/dist/cdn')
            ]
        }
    }
});
