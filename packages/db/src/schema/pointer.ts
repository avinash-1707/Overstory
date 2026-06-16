import { index, pgTable, text, unique } from 'drizzle-orm/pg-core'
import { decisions } from './decision'
import { driftStatus, pointerKind } from './_enums'
import { ulidPk } from './_columns'
import type { DecisionId, PointerId } from './_ids'

// Pointer — code reference (address, not contents), D15. The bidirectional path<->decision index.
// No line numbers as primary anchor — symbol/anchor survive refactors; resolved via ts-morph.
export const pointers = pgTable(
  'pointers',
  {
    id: ulidPk<PointerId>(),
    decisionId: text('decision_id')
      .$type<DecisionId>()
      .notNull()
      .references(() => decisions.id, { onDelete: 'cascade' }),
    kind: pointerKind('kind').notNull(),
    filePath: text('file_path').notNull(), // normalized, repo-relative
    symbol: text('symbol'), // e.g. "AuthMiddleware.verify"
    anchorHint: text('anchor_hint'),
    lastResolvedSha: text('last_resolved_sha').notNull(),
    driftStatus: driftStatus('drift_status').default('fresh').notNull(),
  },
  (t) => [
    // file -> decisions (guard / contradiction, D17). text_pattern_ops so the directory-scope
    // prefix query (file_path LIKE $1 || '/%') uses the index under any DB collation; it also
    // serves the exact-match equality lookup.
    index('pointers_file_path_idx').on(t.filePath.op('text_pattern_ops')),
    index('pointers_decision_idx').on(t.decisionId), // decision -> files (navigation, D15)
    // One locus per decision — prevents duplicate pointers (double-served decisions). anchor_hint
    // is part of the key so two distinct anchors in the same file are still allowed; nullsNotDistinct
    // so a second file-level pointer (symbol/anchor both null) to the same path is still caught.
    unique('pointers_locus_uq')
      .on(t.decisionId, t.filePath, t.symbol, t.anchorHint)
      .nullsNotDistinct(),
  ],
)
