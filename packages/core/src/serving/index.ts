// Serving — path<->decision lookups + ServeEvent logging. See docs/technical/serving.md.
// context (always-on, D20), guard (file->decisions prevent, D17), check (contradiction, D11).
// Every lookup writes a ServeEvent (D28) in the same place it serves.
// TODO: getAlwaysOn, guardByFiles, checkChange, logServeEvent.
export {}
