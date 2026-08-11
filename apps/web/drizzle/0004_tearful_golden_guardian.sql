CREATE TABLE `checkin` (
	`owner_id` text NOT NULL,
	`checkin_date` text NOT NULL,
	`energy` text,
	`motivation` text,
	`time_available_minutes` integer,
	`equipment_unavailable` integer DEFAULT false NOT NULL,
	`discomfort_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checkin_owner_date_idx` ON `checkin` (`owner_id`,`checkin_date`);--> statement-breakpoint
CREATE TABLE `recommendation` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`checkin_date` text NOT NULL,
	`session_index` integer,
	`rule_version` text NOT NULL,
	`confidence` text NOT NULL,
	`reason_codes_json` text NOT NULL,
	`human_reason` text NOT NULL,
	`changes_json` text NOT NULL,
	`alternatives_json` text NOT NULL,
	`missing_data_json` text NOT NULL,
	`important_discomfort` integer DEFAULT false NOT NULL,
	`decision_status` text DEFAULT 'pending' NOT NULL,
	`decided_change_code` text,
	`decided_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `training_plan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recommendation_owner_plan_date_idx` ON `recommendation` (`owner_id`,`plan_id`,`checkin_date`);--> statement-breakpoint
CREATE TABLE `session_adjustment` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`iso_week_start` text NOT NULL,
	`session_index` integer NOT NULL,
	`origin_day` text NOT NULL,
	`kind` text NOT NULL,
	`target_day` text,
	`ops_json` text NOT NULL,
	`recommendation_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `training_plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recommendation_id`) REFERENCES `recommendation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_adjustment_owner_week_session_idx` ON `session_adjustment` (`owner_id`,`plan_id`,`iso_week_start`,`session_index`);