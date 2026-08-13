import { boolean, integer, pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false), image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});
export const session = pgTable("session", {
  id: text("id").primaryKey(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"), userAgent: text("user_agent"), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" })
});
export const account = pgTable("account", {
  id: text("id").primaryKey(), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"), accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }), refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }), scope: text("scope"), password: text("password"), createdAt: timestamp("created_at", { withTimezone: true }).notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});
export const verification = pgTable("verification", { id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }), updatedAt: timestamp("updated_at", { withTimezone: true }) });
export const trainingPlan = pgTable("training_plan", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }), name: text("name").notNull(), status: text("status").notNull().default("draft"), version: integer("version").notNull().default(1), contentJson: text("content_json").notNull().default("{}"), createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  /** Procedencia editorial (plan-template.ts PlanInstance). `source` es "guided" para todo lo creado antes de esta columna y para activaciones que no pasan procedencia explícita; las demás quedan null. */
  source: text("source"), sourceTemplateId: text("source_template_id"), sourceTemplateVersion: text("source_template_version"), catalogVersion: text("catalog_version")
}, (table) => [uniqueIndex("training_plan_owner_id_idx").on(table.ownerId, table.id)]);

/** One row per account: the in-progress onboarding form, persisted step by step so a reload never loses answers. */
export const onboardingDraft = pgTable("onboarding_draft", {
  ownerId: text("owner_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  formJson: text("form_json").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const planProposal = pgTable("plan_proposal", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  proposalJson: text("proposal_json").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => [uniqueIndex("plan_proposal_owner_id_idx").on(table.ownerId, table.id)]);

/** favorite_variant.variant_id references the static editorial catalog (src/features/catalog/data/exercise-catalog.ts), not a DB table. */
export const favoriteVariant = pgTable("favorite_variant", {
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  variantId: text("variant_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => [uniqueIndex("favorite_variant_owner_variant_idx").on(table.ownerId, table.variantId)]);

/** One executed (or in-progress) strength workout, tied to a plan's week.sessions[sessionIndex]. `version` only guards `finish`: two devices (or an offline replay racing a newer close) closing the same session must never overwrite each other silently. */
export const workoutSession = pgTable("workout_session", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull().references(() => trainingPlan.id, { onDelete: "cascade" }),
  sessionIndex: integer("session_index").notNull(),
  status: text("status").notNull().default("in_progress"),
  version: integer("version").notNull().default(1),
  /** clientOperationId of the last successfully-applied `finish` call. Replaying that same id (an outbox retry) is a no-op success, never a VERSION_CONFLICT — only a genuinely different operation racing a stale baseVersion conflicts. */
  lastFinishOperationId: text("last_finish_operation_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  globalEffort: integer("global_effort"),
  comment: text("comment"),
  discomfortJson: text("discomfort_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => [uniqueIndex("workout_session_owner_id_idx").on(table.ownerId, table.id)]);

/** A slot within a workout session. Substituting a variant inserts a new row (status "replaced" on the old one) so both variants keep independent set_performance history. */
export const sessionExercise = pgTable("session_exercise", {
  id: text("id").primaryKey(),
  workoutSessionId: text("workout_session_id").notNull().references(() => workoutSession.id, { onDelete: "cascade" }),
  variantId: text("variant_id").notNull(),
  position: integer("position").notNull(),
  status: text("status").notNull().default("active"),
  /** Snapshot of the assignment at exposure time, so progression compares exposures by the target that actually applied then. */
  targetSets: integer("target_sets").notNull(),
  targetRepsMin: integer("target_reps_min").notNull(),
  targetRepsMax: integer("target_reps_max").notNull()
});

export const setPerformance = pgTable("set_performance", {
  id: text("id").primaryKey(),
  sessionExerciseId: text("session_exercise_id").notNull().references(() => sessionExercise.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  loadKg: integer("load_kg"),
  repetitions: integer("repetitions"),
  difficulty: text("difficulty"),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull()
}, (table) => [uniqueIndex("set_performance_exercise_set_idx").on(table.sessionExerciseId, table.setNumber)]);

/** Derived cache, reconstructible from set_performance history; never authoritative over real sets. */
export const performanceBaseline = pgTable("performance_baseline", {
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  variantId: text("variant_id").notNull(),
  confidence: integer("confidence"),
  summaryJson: text("summary_json").notNull(),
  ruleVersion: text("rule_version").notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull()
}, (table) => [uniqueIndex("performance_baseline_owner_variant_idx").on(table.ownerId, table.variantId)]);

/** One check-in per owner per calendar day; resubmitting the same day overwrites, never duplicates. */
export const checkin = pgTable("checkin", {
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  checkinDate: text("checkin_date").notNull(),
  energy: text("energy"),
  motivation: text("motivation"),
  timeAvailableMinutes: integer("time_available_minutes"),
  equipmentUnavailable: boolean("equipment_unavailable").notNull().default(false),
  discomfortJson: text("discomfort_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => [uniqueIndex("checkin_owner_date_idx").on(table.ownerId, table.checkinDate)]);

/** One rule-engine evaluation (candidates + explanation) for a day/session, with the person's decision recorded inline: a recommendation is decided exactly once, so this doubles as the RecommendationDecision and the rule_evaluation audit row. Resubmitting a check-in the same day regenerates and overwrites (never duplicates). */
export const recommendation = pgTable("recommendation", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull().references(() => trainingPlan.id, { onDelete: "cascade" }),
  checkinDate: text("checkin_date").notNull(),
  sessionIndex: integer("session_index"),
  ruleVersion: text("rule_version").notNull(),
  confidence: text("confidence").notNull(),
  reasonCodesJson: text("reason_codes_json").notNull(),
  humanReason: text("human_reason").notNull(),
  changesJson: text("changes_json").notNull(),
  alternativesJson: text("alternatives_json").notNull(),
  missingDataJson: text("missing_data_json").notNull(),
  /** JSON ExternalActivityEvidence | null — the imported/manual endurance activity (sport/duration/distance, never invented pace/HR/power) the engine actually used for this recommendation, if any (Bloqueante 2). */
  externalEvidenceJson: text("external_evidence_json"),
  importantDiscomfort: boolean("important_discomfort").notNull().default(false),
  decisionStatus: text("decision_status").notNull().default("pending"),
  decidedChangeCode: text("decided_change_code"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => [uniqueIndex("recommendation_owner_plan_date_idx").on(table.ownerId, table.planId, table.checkinDate)]);

/** The mechanical effect of an applied recommendation on one planned session occurrence, scoped to its ISO week. Never mutates the plan template/catalog. One row per (owner, plan, week, sessionIndex): re-deciding the same occurrence overwrites it, so an occurrence is never duplicated. */
export const sessionAdjustment = pgTable("session_adjustment", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull().references(() => trainingPlan.id, { onDelete: "cascade" }),
  isoWeekStart: text("iso_week_start").notNull(),
  sessionIndex: integer("session_index").notNull(),
  originDay: text("origin_day").notNull(),
  kind: text("kind").notNull(),
  targetDay: text("target_day"),
  opsJson: text("ops_json").notNull(),
  /** Null for a direct manual plan edit (Bloqueante 1: move/skip/remove/add from /plan) — only a check-in-driven adjustment (Fase 2) has a recommendation. */
  recommendationId: text("recommendation_id").references(() => recommendation.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => [uniqueIndex("session_adjustment_owner_week_session_idx").on(table.ownerId, table.planId, table.isoWeekStart, table.sessionIndex)]);

/** A real, loggable recovery/mobility session (Bloqueante 3) — converts today's strength/endurance occurrence into an actual startable/finishable session instead of just hiding its CTA. Deliberately has no session_exercise/set_performance rows: it never contributes strength volume or feeds progression (progression only ever reads workout_session-linked rows). Same (planId, sessionIndex) sharing-across-weeks identity as workout_session, for the same documented reason. */
export const recoverySession = pgTable("recovery_session", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull().references(() => trainingPlan.id, { onDelete: "cascade" }),
  sessionIndex: integer("session_index").notNull(),
  status: text("status").notNull().default("in_progress"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => [uniqueIndex("recovery_session_owner_id_idx").on(table.ownerId, table.id)]);

/** Optional, dated weight/measurement entry. No correction/versioning yet (declared debt): a new entry never overwrites an old one, trend just reads the two most recent rows of the same kind+zone. Never derives BMI, body fat or an "ideal weight" — value/unit only. */
export const bodyMetric = pgTable("body_metric", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  zone: text("zone"),
  value: real("value").notNull(),
  unit: text("unit").notNull(),
  measuredAt: text("measured_at").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

/** The person's own block design for one planned endurance session occurrence (same owner/plan/isoWeekStart/sessionIndex identity as session_adjustment — never a duplicate table for the same concept). Re-saving the same occurrence overwrites, never duplicates. watchPreparedAt is set only by "ya está creado en mi reloj"; Trainer never contacts a watch or device. */
export const enduranceSessionDesign = pgTable("endurance_session_design", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull().references(() => trainingPlan.id, { onDelete: "cascade" }),
  isoWeekStart: text("iso_week_start").notNull(),
  sessionIndex: integer("session_index").notNull(),
  objective: text("objective").notNull(),
  environment: text("environment"),
  optionalLayersJson: text("optional_layers_json"),
  watchPreparedAt: timestamp("watch_prepared_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => [uniqueIndex("endurance_session_design_owner_week_session_idx").on(table.ownerId, table.planId, table.isoWeekStart, table.sessionIndex)]);

/** Private, uploaded FIT/TCX/GPX bytes, stored outside the public web root (see storage.ts). sha256 is unique per owner: re-uploading the exact same bytes never creates a second row. */
export const importFile = pgTable("import_file", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  originalName: text("original_name").notNull(),
  format: text("format").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
}, (table) => [uniqueIndex("import_file_owner_sha256_idx").on(table.ownerId, table.sha256)]);

/** One upload's lifecycle: received -> analyzed | duplicate | failed -> saved. analysisJson holds the ParsedActivity the parser produced (only fields actually present in the file), so a page reload never re-parses. */
export const activityImport = pgTable("activity_import", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  fileId: text("file_id").notNull().references(() => importFile.id, { onDelete: "cascade" }),
  format: text("format").notNull(),
  status: text("status").notNull(),
  errorCode: text("error_code"),
  analysisJson: text("analysis_json"),
  duplicateOfActivityId: text("duplicate_of_activity_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

/** A resistance activity, manual or imported. isoWeekStart/sessionIndex are an optional link to a planned occurrence (same identity model as session_adjustment); null means "independent activity", never a fabricated link. fingerprint (sport + rounded start + rounded duration) is the soft duplicate check offered before committing an import — never blocks by itself, only warns. */
export const enduranceActivity = pgTable("endurance_activity", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  importId: text("import_id").references(() => activityImport.id, { onDelete: "set null" }),
  planId: text("plan_id").references(() => trainingPlan.id, { onDelete: "set null" }),
  isoWeekStart: text("iso_week_start"),
  sessionIndex: integer("session_index"),
  sport: text("sport").notNull(),
  name: text("name").notNull(),
  source: text("source").notNull(),
  fingerprint: text("fingerprint").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  durationS: integer("duration_s"),
  distanceM: real("distance_m"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => [uniqueIndex("endurance_activity_owner_id_idx").on(table.ownerId, table.id)]);

/** One row per metric actually present in the source (file or a person-declared optional layer). Absence of a row IS "not available" — metric_availability from DATA-MODEL-PROPOSAL.md is expressed by the row simply not existing, never by a placeholder value. */
export const activityMetric = pgTable("activity_metric", {
  id: text("id").primaryKey(),
  activityId: text("activity_id").notNull().references(() => enduranceActivity.id, { onDelete: "cascade" }),
  metricType: text("metric_type").notNull(),
  value: real("value").notNull(),
  unit: text("unit").notNull(),
  source: text("source").notNull()
});

/** A share link for a plan's structure (token = id, unguessable). Never exposes loads or history — copy always starts empty, per FUNCTIONAL-SPECIFICATION.md §9. revokedAt disables the token without deleting the audit row. */
export const shareLink = pgTable("share_link", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull().references(() => trainingPlan.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true })
});

/** One independent copy created from a share link. Copying never links back to the origin plan's loads/history/future edits — only structure (content_json) is duplicated into a brand-new training_plan row. */
export const shareCopy = pgTable("share_copy", {
  id: text("id").primaryKey(),
  shareLinkId: text("share_link_id").notNull().references(() => shareLink.id, { onDelete: "cascade" }),
  copiedByOwnerId: text("copied_by_owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  copiedPlanId: text("copied_plan_id").notNull().references(() => trainingPlan.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});
