/**
 * The demo's settings for the guides app (src/host/host-config.ts): both pages
 * sit side by side in demo/, and the storage host is named in the address —
 * `?api=http://localhost:4320` with `npm run receiver` running — or not at all,
 * in which case the app says that no host is connected.
 *
 * The open FlowWeaver's steps only: the demo shows what the open repo ships.
 */
import { configureHost } from "../src/host/host-config.ts";

configureHost({ locale: "sv", editorHref: "./guide-storage.html", guidesHref: "./guides.html" });
