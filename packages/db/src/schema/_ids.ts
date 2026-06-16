// Branded ID types — prevent cross-entity mixups at the type level (data-model.md).
// Applied to columns via `.$type<XId>()`; purely a compile-time guard (runtime = text/ULID).

export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' } // = Better Auth organization.id
export type UserId = string & { readonly __brand: 'UserId' } // = Better Auth user.id
export type RepoId = string & { readonly __brand: 'RepoId' }
export type RepoAccessId = string & { readonly __brand: 'RepoAccessId' }
export type ApiKeyId = string & { readonly __brand: 'ApiKeyId' }
export type FlowId = string & { readonly __brand: 'FlowId' }
export type DecisionId = string & { readonly __brand: 'DecisionId' }
export type PointerId = string & { readonly __brand: 'PointerId' }
export type AnalysisArtifactId = string & { readonly __brand: 'AnalysisArtifactId' }
export type ProvocationId = string & { readonly __brand: 'ProvocationId' }
export type ContradictionEventId = string & { readonly __brand: 'ContradictionEventId' }
export type ServeEventId = string & { readonly __brand: 'ServeEventId' }
