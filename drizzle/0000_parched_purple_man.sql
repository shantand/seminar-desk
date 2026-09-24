CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`text` text NOT NULL,
	`outcome` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_activities_registration` ON `activities` (`registration_id`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`phone` text NOT NULL,
	`name` text NOT NULL,
	`do_not_contact` integer DEFAULT 0 NOT NULL,
	`sample` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contacts_owner_phone` ON `contacts` (`owner`,`phone`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`kind` text DEFAULT 'demo_invitation' NOT NULL,
	`body` text NOT NULL,
	`state` text DEFAULT 'Simulated' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_messages_registration_kind` ON `messages` (`registration_id`,`kind`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`webinar_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`name` text NOT NULL,
	`situation` text NOT NULL,
	`college` text DEFAULT '' NOT NULL,
	`study` text DEFAULT '' NOT NULL,
	`goal` text DEFAULT '' NOT NULL,
	`webinar_consent` integer DEFAULT 0 NOT NULL,
	`followup_consent` integer DEFAULT 0 NOT NULL,
	`consent_text` text NOT NULL,
	`consent_at` text NOT NULL,
	`status` text DEFAULT 'Not contacted' NOT NULL,
	`next_at` text,
	`attendance` text DEFAULT 'Unknown' NOT NULL,
	`created_at` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`webinar_id`) REFERENCES `webinars`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_registrations_webinar_contact` ON `registrations` (`webinar_id`,`contact_id`);--> statement-breakpoint
CREATE INDEX `idx_registrations_contact` ON `registrations` (`contact_id`);--> statement-breakpoint
CREATE TABLE `webinars` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`course` text NOT NULL,
	`batch` text NOT NULL,
	`description` text NOT NULL,
	`organizer` text NOT NULL,
	`starts_at` text NOT NULL,
	`closes_at` text NOT NULL,
	`join_url` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`sample` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_webinars_owner` ON `webinars` (`owner`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`owner` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
