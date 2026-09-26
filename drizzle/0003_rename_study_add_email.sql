ALTER TABLE `registrations` RENAME COLUMN `study` TO `city`;
--> statement-breakpoint
ALTER TABLE `registrations` ADD `email` text DEFAULT '' NOT NULL;
