// Decision — core served unit. D22 (flow scope) + pointers (machine locus).
// TODO(schema): id, repoId, flowId, title, statement, status, rationale (jsonb),
//   alternativesConsidered[], topics[], ranking (jsonb), alwaysOn, provenance (jsonb),
//   captureMethod, supersedesId, supersededById, createdBy, createdAt, updatedAt, lastConfirmedAt.
// Served only in status 'decided'; 'needs_reconfirmation' served flagged; 'superseded' never.
export {}
