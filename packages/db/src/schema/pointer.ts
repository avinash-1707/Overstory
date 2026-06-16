// Pointer — code reference (address, not contents). D15.
// TODO(schema): id, decisionId (FK), kind (file|symbol|anchor), filePath, symbol,
//   anchorHint, lastResolvedSha, driftStatus (fresh|drifted|unresolved).
// Index: pointers(file_path), pointers(decision_id) — the bidirectional path<->decision index.
export {}
