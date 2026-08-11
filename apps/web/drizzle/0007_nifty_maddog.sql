CREATE TABLE `share_copy` (
	`id` text PRIMARY KEY NOT NULL,
	`share_link_id` text NOT NULL,
	`copied_by_owner_id` text NOT NULL,
	`copied_plan_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`share_link_id`) REFERENCES `share_link`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`copied_by_owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`copied_plan_id`) REFERENCES `training_plan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `share_link` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `training_plan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `workout_session` ADD `version` integer DEFAULT 1 NOT NULL;