CREATE TYPE "public"."capture_method" AS ENUM('provoked', 'seeded_confirmed', 'manual');--> statement-breakpoint
CREATE TYPE "public"."contradiction_resolution" AS ENUM('still_true', 'superseded', 'pending');--> statement-breakpoint
CREATE TYPE "public"."contradiction_trigger" AS ENUM('agent_edit', 'pr', 'manual');--> statement-breakpoint
CREATE TYPE "public"."decision_status" AS ENUM('proposed', 'decided', 'needs_reconfirmation', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."drift_status" AS ENUM('fresh', 'drifted', 'unresolved');--> statement-breakpoint
CREATE TYPE "public"."mcp_tool" AS ENUM('context', 'guard', 'check', 'decision', 'search');--> statement-breakpoint
CREATE TYPE "public"."pointer_kind" AS ENUM('file', 'symbol', 'anchor');--> statement-breakpoint
CREATE TYPE "public"."provocation_outcome" AS ENUM('accepted', 'rejected_with_reason', 'pending');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"remote_url" text,
	"primary_language" text DEFAULT 'typescript' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_access" (
	"id" text PRIMARY KEY NOT NULL,
	"repo_id" text NOT NULL,
	"provider" text DEFAULT 'github' NOT NULL,
	"installation_id" text NOT NULL,
	"scopes" text[] DEFAULT '{"contents:read","pull_requests:read"}' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"repo_id" text,
	"hashed_key" text NOT NULL,
	"prefix" text NOT NULL,
	"label" text,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_hashed_key_unique" UNIQUE("hashed_key")
);
--> statement-breakpoint
CREATE TABLE "flows" (
	"id" text PRIMARY KEY NOT NULL,
	"repo_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"current_analysis_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"repo_id" text NOT NULL,
	"flow_id" text NOT NULL,
	"title" text NOT NULL,
	"statement" text NOT NULL,
	"status" "decision_status" DEFAULT 'proposed' NOT NULL,
	"rationale" jsonb NOT NULL,
	"alternatives_considered" text[] DEFAULT '{}' NOT NULL,
	"topics" text[] DEFAULT '{}' NOT NULL,
	"ranking" jsonb NOT NULL,
	"always_on" boolean DEFAULT false NOT NULL,
	"provenance" jsonb,
	"capture_method" "capture_method" NOT NULL,
	"supersedes_id" text,
	"superseded_by_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pointers" (
	"id" text PRIMARY KEY NOT NULL,
	"decision_id" text NOT NULL,
	"kind" "pointer_kind" NOT NULL,
	"file_path" text NOT NULL,
	"symbol" text,
	"anchor_hint" text,
	"last_resolved_sha" text NOT NULL,
	"drift_status" "drift_status" DEFAULT 'fresh' NOT NULL,
	CONSTRAINT "pointers_locus_uq" UNIQUE NULLS NOT DISTINCT("decision_id","file_path","symbol","anchor_hint")
);
--> statement-breakpoint
CREATE TABLE "analysis_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"flow_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"supersedes_version_id" text,
	"content" jsonb NOT NULL,
	"seeded_from" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provocations" (
	"id" text PRIMARY KEY NOT NULL,
	"flow_id" text NOT NULL,
	"decision_id" text,
	"alternative" text NOT NULL,
	"tradeoffs" text NOT NULL,
	"outcome" "provocation_outcome" DEFAULT 'pending' NOT NULL,
	"produced_rationale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contradiction_events" (
	"id" text PRIMARY KEY NOT NULL,
	"decision_id" text NOT NULL,
	"trigger" "contradiction_trigger" NOT NULL,
	"detail" text NOT NULL,
	"changed_files" text[] DEFAULT '{}' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolution" "contradiction_resolution" DEFAULT 'pending' NOT NULL,
	"resolved_decision_id" text
);
--> statement-breakpoint
CREATE TABLE "serve_events" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"repo_id" text NOT NULL,
	"session_id" text NOT NULL,
	"tool" "mcp_tool" NOT NULL,
	"query" jsonb NOT NULL,
	"served_decision_ids" text[] DEFAULT '{}' NOT NULL,
	"conflict_decision_ids" text[] DEFAULT '{}' NOT NULL,
	"latency_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repos" ADD CONSTRAINT "repos_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_access" ADD CONSTRAINT "repo_access_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_supersedes_id_decisions_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_superseded_by_id_decisions_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pointers" ADD CONSTRAINT "pointers_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_artifacts" ADD CONSTRAINT "analysis_artifacts_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_artifacts" ADD CONSTRAINT "analysis_artifacts_supersedes_version_id_analysis_artifacts_id_fk" FOREIGN KEY ("supersedes_version_id") REFERENCES "public"."analysis_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provocations" ADD CONSTRAINT "provocations_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provocations" ADD CONSTRAINT "provocations_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contradiction_events" ADD CONSTRAINT "contradiction_events_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contradiction_events" ADD CONSTRAINT "contradiction_events_resolved_decision_id_decisions_id_fk" FOREIGN KEY ("resolved_decision_id") REFERENCES "public"."decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serve_events" ADD CONSTRAINT "serve_events_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serve_events" ADD CONSTRAINT "serve_events_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "repos_workspace_idx" ON "repos" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repos_workspace_name_uidx" ON "repos" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "repo_access_repo_idx" ON "repo_access" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "api_keys_workspace_idx" ON "api_keys" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "api_keys_repo_idx" ON "api_keys" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "flows_repo_idx" ON "flows" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "decisions_repo_idx" ON "decisions" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "decisions_flow_idx" ON "decisions" USING btree ("flow_id");--> statement-breakpoint
CREATE INDEX "decisions_alwayson_idx" ON "decisions" USING btree ("repo_id","always_on","status");--> statement-breakpoint
CREATE INDEX "pointers_file_path_idx" ON "pointers" USING btree ("file_path" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "pointers_decision_idx" ON "pointers" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "analysis_artifacts_flow_idx" ON "analysis_artifacts" USING btree ("flow_id");--> statement-breakpoint
CREATE INDEX "provocations_flow_idx" ON "provocations" USING btree ("flow_id");--> statement-breakpoint
CREATE INDEX "provocations_decision_idx" ON "provocations" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "contradiction_events_decision_idx" ON "contradiction_events" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "serve_events_repo_created_idx" ON "serve_events" USING btree ("repo_id","created_at");--> statement-breakpoint
CREATE INDEX "serve_events_session_idx" ON "serve_events" USING btree ("session_id");