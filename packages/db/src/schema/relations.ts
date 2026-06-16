import { relations } from 'drizzle-orm'
import { organization, user } from './auth'
import { repos } from './repo'
import { repoAccess } from './repo-access'
import { apiKeys } from './api-key'
import { flows } from './flow'
import { decisions } from './decision'
import { pointers } from './pointer'
import { analysisArtifacts } from './analysis-artifact'
import { provocations } from './provocation'
import { contradictionEvents } from './contradiction-event'
import { serveEvents } from './serve-event'

// Domain relations for the Drizzle relational query API (db.query.*.findMany({ with: ... })).
// Only the domain `one()` side touches auth tables (organization/user) — their reverse relations
// live in the generated auth.ts and must not be redefined here. Self-references (supersedes,
// resolvedDecision, currentAnalysis) are queried by id rather than modeled as relations.

export const reposRelations = relations(repos, ({ one, many }) => ({
  workspace: one(organization, { fields: [repos.workspaceId], references: [organization.id] }),
  access: many(repoAccess),
  apiKeys: many(apiKeys),
  flows: many(flows),
  decisions: many(decisions),
  serveEvents: many(serveEvents),
}))

export const repoAccessRelations = relations(repoAccess, ({ one }) => ({
  repo: one(repos, { fields: [repoAccess.repoId], references: [repos.id] }),
}))

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  workspace: one(organization, { fields: [apiKeys.workspaceId], references: [organization.id] }),
  repo: one(repos, { fields: [apiKeys.repoId], references: [repos.id] }),
}))

export const flowsRelations = relations(flows, ({ one, many }) => ({
  repo: one(repos, { fields: [flows.repoId], references: [repos.id] }),
  decisions: many(decisions),
  analysisArtifacts: many(analysisArtifacts),
  provocations: many(provocations),
}))

export const decisionsRelations = relations(decisions, ({ one, many }) => ({
  repo: one(repos, { fields: [decisions.repoId], references: [repos.id] }),
  flow: one(flows, { fields: [decisions.flowId], references: [flows.id] }),
  author: one(user, { fields: [decisions.createdBy], references: [user.id] }),
  pointers: many(pointers),
  provocations: many(provocations),
  contradictionEvents: many(contradictionEvents),
}))

export const pointersRelations = relations(pointers, ({ one }) => ({
  decision: one(decisions, { fields: [pointers.decisionId], references: [decisions.id] }),
}))

export const analysisArtifactsRelations = relations(analysisArtifacts, ({ one }) => ({
  flow: one(flows, { fields: [analysisArtifacts.flowId], references: [flows.id] }),
}))

export const provocationsRelations = relations(provocations, ({ one }) => ({
  flow: one(flows, { fields: [provocations.flowId], references: [flows.id] }),
  decision: one(decisions, { fields: [provocations.decisionId], references: [decisions.id] }),
}))

export const contradictionEventsRelations = relations(contradictionEvents, ({ one }) => ({
  decision: one(decisions, { fields: [contradictionEvents.decisionId], references: [decisions.id] }),
}))

export const serveEventsRelations = relations(serveEvents, ({ one }) => ({
  workspace: one(organization, { fields: [serveEvents.workspaceId], references: [organization.id] }),
  repo: one(repos, { fields: [serveEvents.repoId], references: [repos.id] }),
}))
