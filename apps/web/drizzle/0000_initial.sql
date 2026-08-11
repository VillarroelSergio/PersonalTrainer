CREATE TABLE `user` (`id` text PRIMARY KEY NOT NULL, `name` text NOT NULL, `email` text NOT NULL, `email_verified` integer DEFAULT false NOT NULL, `image` text, `created_at` integer NOT NULL, `updated_at` integer NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);
--> statement-breakpoint
CREATE TABLE `session` (`id` text PRIMARY KEY NOT NULL, `expires_at` integer NOT NULL, `token` text NOT NULL, `created_at` integer NOT NULL, `updated_at` integer NOT NULL, `ip_address` text, `user_agent` text, `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);
--> statement-breakpoint
CREATE TABLE `account` (`id` text PRIMARY KEY NOT NULL, `account_id` text NOT NULL, `provider_id` text NOT NULL, `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade, `access_token` text, `refresh_token` text, `id_token` text, `access_token_expires_at` integer, `refresh_token_expires_at` integer, `scope` text, `password` text, `created_at` integer NOT NULL, `updated_at` integer NOT NULL);
--> statement-breakpoint
CREATE TABLE `verification` (`id` text PRIMARY KEY NOT NULL, `identifier` text NOT NULL, `value` text NOT NULL, `expires_at` integer NOT NULL, `created_at` integer, `updated_at` integer);
--> statement-breakpoint
CREATE TABLE `training_plan` (`id` text PRIMARY KEY NOT NULL, `owner_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade, `name` text NOT NULL, `status` text DEFAULT 'draft' NOT NULL, `version` integer DEFAULT 1 NOT NULL, `created_at` integer NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_plan_owner_id_idx` ON `training_plan` (`owner_id`, `id`);
