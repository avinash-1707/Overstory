// RepoAccess — GitHub App installation, read-only least-privilege. D27.
// TODO(schema): id, repoId (FK), provider, installationId, scopes[], connectedAt.
// Security: store only installationId; mint short-lived tokens from a KMS-held app key.
export {}
