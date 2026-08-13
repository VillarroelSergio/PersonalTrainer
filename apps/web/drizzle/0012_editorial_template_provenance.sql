ALTER TABLE `training_plan` ADD `source` text;--> statement-breakpoint
ALTER TABLE `training_plan` ADD `source_template_id` text;--> statement-breakpoint
ALTER TABLE `training_plan` ADD `source_template_version` text;--> statement-breakpoint
ALTER TABLE `training_plan` ADD `catalog_version` text;--> statement-breakpoint
UPDATE `training_plan` SET `source` = 'guided' WHERE `source` IS NULL;