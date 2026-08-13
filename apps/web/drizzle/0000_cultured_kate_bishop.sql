CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_import" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"file_id" text NOT NULL,
	"format" text NOT NULL,
	"status" text NOT NULL,
	"error_code" text,
	"analysis_json" text,
	"duplicate_of_activity_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_metric" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"metric_type" text NOT NULL,
	"value" real NOT NULL,
	"unit" text NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_metric" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"zone" text,
	"value" real NOT NULL,
	"unit" text NOT NULL,
	"measured_at" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkin" (
	"owner_id" text NOT NULL,
	"checkin_date" text NOT NULL,
	"energy" text,
	"motivation" text,
	"time_available_minutes" integer,
	"equipment_unavailable" boolean DEFAULT false NOT NULL,
	"discomfort_json" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "endurance_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"import_id" text,
	"plan_id" text,
	"iso_week_start" text,
	"session_index" integer,
	"sport" text NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"fingerprint" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"duration_s" integer,
	"distance_m" real,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "endurance_session_design" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"iso_week_start" text NOT NULL,
	"session_index" integer NOT NULL,
	"objective" text NOT NULL,
	"environment" text,
	"optional_layers_json" text,
	"watch_prepared_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite_variant" (
	"owner_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_file" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"format" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "onboarding_draft" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"form_json" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_baseline" (
	"owner_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"confidence" integer,
	"summary_json" text NOT NULL,
	"rule_version" text NOT NULL,
	"calculated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"proposal_json" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"checkin_date" text NOT NULL,
	"session_index" integer,
	"rule_version" text NOT NULL,
	"confidence" text NOT NULL,
	"reason_codes_json" text NOT NULL,
	"human_reason" text NOT NULL,
	"changes_json" text NOT NULL,
	"alternatives_json" text NOT NULL,
	"missing_data_json" text NOT NULL,
	"external_evidence_json" text,
	"important_discomfort" boolean DEFAULT false NOT NULL,
	"decision_status" text DEFAULT 'pending' NOT NULL,
	"decided_change_code" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_session" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"session_index" integer NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"comment" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "session_adjustment" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"iso_week_start" text NOT NULL,
	"session_index" integer NOT NULL,
	"origin_day" text NOT NULL,
	"kind" text NOT NULL,
	"target_day" text,
	"ops_json" text NOT NULL,
	"recommendation_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_exercise" (
	"id" text PRIMARY KEY NOT NULL,
	"workout_session_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"position" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"target_sets" integer NOT NULL,
	"target_reps_min" integer NOT NULL,
	"target_reps_max" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "set_performance" (
	"id" text PRIMARY KEY NOT NULL,
	"session_exercise_id" text NOT NULL,
	"set_number" integer NOT NULL,
	"load_kg" integer,
	"repetitions" integer,
	"difficulty" text,
	"completed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_copy" (
	"id" text PRIMARY KEY NOT NULL,
	"share_link_id" text NOT NULL,
	"copied_by_owner_id" text NOT NULL,
	"copied_plan_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_link" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "training_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"source" text,
	"source_template_id" text,
	"source_template_version" text,
	"catalog_version" text
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workout_session" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"session_index" integer NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"last_finish_operation_id" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"global_effort" integer,
	"comment" text,
	"discomfort_json" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_import" ADD CONSTRAINT "activity_import_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_import" ADD CONSTRAINT "activity_import_file_id_import_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."import_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_metric" ADD CONSTRAINT "activity_metric_activity_id_endurance_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."endurance_activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_metric" ADD CONSTRAINT "body_metric_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin" ADD CONSTRAINT "checkin_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endurance_activity" ADD CONSTRAINT "endurance_activity_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endurance_activity" ADD CONSTRAINT "endurance_activity_import_id_activity_import_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."activity_import"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endurance_activity" ADD CONSTRAINT "endurance_activity_plan_id_training_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plan"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endurance_session_design" ADD CONSTRAINT "endurance_session_design_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endurance_session_design" ADD CONSTRAINT "endurance_session_design_plan_id_training_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_variant" ADD CONSTRAINT "favorite_variant_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_file" ADD CONSTRAINT "import_file_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_draft" ADD CONSTRAINT "onboarding_draft_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_baseline" ADD CONSTRAINT "performance_baseline_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_proposal" ADD CONSTRAINT "plan_proposal_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_plan_id_training_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_session" ADD CONSTRAINT "recovery_session_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_session" ADD CONSTRAINT "recovery_session_plan_id_training_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_adjustment" ADD CONSTRAINT "session_adjustment_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_adjustment" ADD CONSTRAINT "session_adjustment_plan_id_training_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_adjustment" ADD CONSTRAINT "session_adjustment_recommendation_id_recommendation_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."recommendation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_workout_session_id_workout_session_id_fk" FOREIGN KEY ("workout_session_id") REFERENCES "public"."workout_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_performance" ADD CONSTRAINT "set_performance_session_exercise_id_session_exercise_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_copy" ADD CONSTRAINT "share_copy_share_link_id_share_link_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."share_link"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_copy" ADD CONSTRAINT "share_copy_copied_by_owner_id_user_id_fk" FOREIGN KEY ("copied_by_owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_copy" ADD CONSTRAINT "share_copy_copied_plan_id_training_plan_id_fk" FOREIGN KEY ("copied_plan_id") REFERENCES "public"."training_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_plan_id_training_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan" ADD CONSTRAINT "training_plan_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_plan_id_training_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checkin_owner_date_idx" ON "checkin" USING btree ("owner_id","checkin_date");--> statement-breakpoint
CREATE UNIQUE INDEX "endurance_activity_owner_id_idx" ON "endurance_activity" USING btree ("owner_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "endurance_session_design_owner_week_session_idx" ON "endurance_session_design" USING btree ("owner_id","plan_id","iso_week_start","session_index");--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_variant_owner_variant_idx" ON "favorite_variant" USING btree ("owner_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "import_file_owner_sha256_idx" ON "import_file" USING btree ("owner_id","sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "performance_baseline_owner_variant_idx" ON "performance_baseline" USING btree ("owner_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_proposal_owner_id_idx" ON "plan_proposal" USING btree ("owner_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_owner_plan_date_idx" ON "recommendation" USING btree ("owner_id","plan_id","checkin_date");--> statement-breakpoint
CREATE UNIQUE INDEX "recovery_session_owner_id_idx" ON "recovery_session" USING btree ("owner_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_adjustment_owner_week_session_idx" ON "session_adjustment" USING btree ("owner_id","plan_id","iso_week_start","session_index");--> statement-breakpoint
CREATE UNIQUE INDEX "set_performance_exercise_set_idx" ON "set_performance" USING btree ("session_exercise_id","set_number");--> statement-breakpoint
CREATE UNIQUE INDEX "training_plan_owner_id_idx" ON "training_plan" USING btree ("owner_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_session_owner_id_idx" ON "workout_session" USING btree ("owner_id","id");