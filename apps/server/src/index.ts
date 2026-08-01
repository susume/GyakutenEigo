/**
 * Public server entry point. The runtime implementation lives separately so
 * bootstrap, lifecycle, and real-time game code can evolve independently.
 */
import "./runtime.js";

export { advanceBots, app, io, server } from "./runtime.js";
