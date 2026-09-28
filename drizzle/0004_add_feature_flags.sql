CREATE TABLE `feature_flags` (
	`owner` text NOT NULL,
	`key` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `key`)
);
