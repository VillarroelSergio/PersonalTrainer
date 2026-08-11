PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session_adjustment` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`iso_week_start` text NOT NULL,
	`session_index` integer NOT NULL,
	`origin_day` text NOT NULL,
	`kind` text NOT NULL,
	`target_day` text,
	`ops_json` text NOT NULL,
	`recommendation_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `training_plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recommendation_id`) REFERENCES `recommendation`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_session_adjustment`("id", "owner_id", "plan_id", "iso_week_start", "session_index", "origin_day", "kind", "target_day", "ops_json", "recommendation_id", "created_at") SELECT "id", "owner_id", "plan_id", "iso_week_start", "session_index", "origin_day", "kind", "target_day", "ops_json", "recommendation_id", "created_at" FROM `session_adjustment`;--> statement-breakpoint
DROP TABLE `session_adjustment`;--> statement-breakpoint
ALTER TABLE `__new_session_adjustment` RENAME TO `session_adjustment`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `session_adjustment_owner_week_session_idx` ON `session_adjustment` (`owner_id`,`plan_id`,`iso_week_start`,`session_index`);