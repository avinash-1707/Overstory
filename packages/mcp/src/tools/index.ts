// MCP tool definitions. Each `description` is part of the prevent mechanism (D17) —
// written to prompt the agent to call it at the right moment.
//
//   overstory_context  — always-on tier (D20), call at task start
//   overstory_guard    — file->decisions prevent (D17), call before editing
//   overstory_check    — agent-side contradiction catch (D11)
//   overstory_decision — read one decision in full
//   overstory_search   — fuzzy task -> decisions (optional)
//
// TODO: export tool specs + handlers (handlers call the api over HTTP).
export {}
