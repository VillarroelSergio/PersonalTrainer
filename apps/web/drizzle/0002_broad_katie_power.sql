CREATE TABLE `favorite_variant` (
	`owner_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorite_variant_owner_variant_idx` ON `favorite_variant` (`owner_id`,`variant_id`);--> statement-breakpoint
CREATE TABLE `performance_baseline` (
	`owner_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`confidence` integer,
	`summary_json` text NOT NULL,
	`rule_version` text NOT NULL,
	`calculated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `performance_baseline_owner_variant_idx` ON `performance_baseline` (`owner_id`,`variant_id`);--> statement-breakpoint
CREATE TABLE `session_exercise` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_session_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`position` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`workout_session_id`) REFERENCES `workout_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `set_performance` (
	`id` text PRIMARY KEY NOT NULL,
	`session_exercise_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`load_kg` integer,
	`repetitions` integer,
	`difficulty` text,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`session_exercise_id`) REFERENCES `session_exercise`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `set_performance_exercise_set_idx` ON `set_performance` (`session_exercise_id`,`set_number`);--> statement-breakpoint
CREATE TABLE `workout_session` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`session_index` integer NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`global_effort` integer,
	`comment` text,
	`discomfort_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `training_plan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workout_session_owner_id_idx` ON `workout_session` (`owner_id`,`id`);