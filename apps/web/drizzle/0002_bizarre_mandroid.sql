DROP INDEX "checkin_owner_date_idx";--> statement-breakpoint
DROP INDEX "favorite_variant_owner_variant_idx";--> statement-breakpoint
DROP INDEX "performance_baseline_owner_variant_idx";--> statement-breakpoint
ALTER TABLE "checkin" ADD CONSTRAINT "checkin_pkey" PRIMARY KEY("owner_id","checkin_date");--> statement-breakpoint
ALTER TABLE "favorite_variant" ADD CONSTRAINT "favorite_variant_pkey" PRIMARY KEY("owner_id","variant_id");--> statement-breakpoint
ALTER TABLE "performance_baseline" ADD CONSTRAINT "performance_baseline_pkey" PRIMARY KEY("owner_id","variant_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_import_owner_id_idx" ON "activity_import" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "activity_import_file_id_idx" ON "activity_import" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "activity_metric_activity_id_idx" ON "activity_metric" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "body_metric_owner_id_idx" ON "body_metric" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "endurance_activity_import_id_idx" ON "endurance_activity" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "endurance_activity_plan_id_idx" ON "endurance_activity" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "endurance_activity_owner_started_at_idx" ON "endurance_activity" USING btree ("owner_id","started_at");--> statement-breakpoint
CREATE INDEX "endurance_session_design_plan_id_idx" ON "endurance_session_design" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "import_file_owner_id_idx" ON "import_file" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "plan_proposal_owner_id_lookup_idx" ON "plan_proposal" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "recommendation_owner_id_idx" ON "recommendation" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "recommendation_plan_id_idx" ON "recommendation" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "recovery_session_plan_status_idx" ON "recovery_session" USING btree ("owner_id","plan_id","status");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_adjustment_recommendation_id_idx" ON "session_adjustment" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "session_exercise_workout_session_id_idx" ON "session_exercise" USING btree ("workout_session_id");--> statement-breakpoint
CREATE INDEX "session_exercise_workout_status_idx" ON "session_exercise" USING btree ("workout_session_id","status");--> statement-breakpoint
CREATE INDEX "share_copy_share_link_id_idx" ON "share_copy" USING btree ("share_link_id");--> statement-breakpoint
CREATE INDEX "share_copy_copied_by_owner_id_idx" ON "share_copy" USING btree ("copied_by_owner_id");--> statement-breakpoint
CREATE INDEX "share_copy_copied_plan_id_idx" ON "share_copy" USING btree ("copied_plan_id");--> statement-breakpoint
CREATE INDEX "share_link_owner_id_idx" ON "share_link" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "share_link_plan_id_idx" ON "share_link" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "workout_session_plan_status_idx" ON "workout_session" USING btree ("owner_id","plan_id","session_index","status");--> statement-breakpoint
CREATE INDEX "workout_session_plan_started_at_idx" ON "workout_session" USING btree ("owner_id","plan_id","started_at");