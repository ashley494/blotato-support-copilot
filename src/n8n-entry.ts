// Entry point bundled into a single n8n Code node (scripts/build-n8n.mjs).
// Same rules as the CLI and MCP server, no network calls, no dependencies.
export { explainError } from "./explain.js";
export { gateReply } from "./gate.js";
export { validatePost } from "./validate.js";
export { safetyScreen, SAFETY_REPLY, looksEnglish } from "./safety.js";
