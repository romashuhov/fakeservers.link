import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Ports: see ../../../PORTS.md, project 02 (front 4302, API 4202).
const apiPort = process.env.API_PORT ?? "4202";

export default defineConfig({
	plugins: [svelte(), tailwindcss()],
	server: {
		port: 4302,
		strictPort: true,
		proxy: { "/api": `http://localhost:${apiPort}` },
	},
	build: { outDir: "dist", emptyOutDir: true },
});
