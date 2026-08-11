CREATE TABLE `onboarding_draft` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`form_json` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plan_proposal` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`proposal_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_proposal_owner_id_idx` ON `plan_proposal` (`owner_id`,`id`);
--> statement-breakpoint
ALTER TABLE `training_plan` ADD `content_json` text DEFAULT '{}' NOT NULL;
