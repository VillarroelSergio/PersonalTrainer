CREATE TABLE `activity_import` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`file_id` text NOT NULL,
	`format` text NOT NULL,
	`status` text NOT NULL,
	`error_code` text,
	`analysis_json` text,
	`duplicate_of_activity_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `import_file`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `activity_metric` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`metric_type` text NOT NULL,
	`value` real NOT NULL,
	`unit` text NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `endurance_activity`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `endurance_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`import_id` text,
	`plan_id` text,
	`iso_week_start` text,
	`session_index` integer,
	`sport` text NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`fingerprint` text NOT NULL,
	`started_at` integer NOT NULL,
	`duration_s` integer,
	`distance_m` real,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`import_id`) REFERENCES `activity_import`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`plan_id`) REFERENCES `training_plan`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `endurance_activity_owner_id_idx` ON `endurance_activity` (`owner_id`,`id`);--> statement-breakpoint
CREATE TABLE `endurance_session_design` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`iso_week_start` text NOT NULL,
	`session_index` integer NOT NULL,
	`objective` text NOT NULL,
	`environment` text,
	`optional_layers_json` text,
	`watch_prepared_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `training_plan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `endurance_session_design_owner_week_session_idx` ON `endurance_session_design` (`owner_id`,`plan_id`,`iso_week_start`,`session_index`);--> statement-breakpoint
CREATE TABLE `import_file` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`original_name` text NOT NULL,
	`format` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_file_owner_sha256_idx` ON `import_file` (`owner_id`,`sha256`);