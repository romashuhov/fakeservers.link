import { mount } from "svelte";
import App from "./App.svelte";
import { initLocale } from "./lib/i18n.svelte";
import "./app.css";

const target = document.getElementById("app");
if (!target) throw new Error("#app not found");

// Pick the language before the first paint so nothing flashes in English first.
await initLocale();

export default mount(App, { target });
