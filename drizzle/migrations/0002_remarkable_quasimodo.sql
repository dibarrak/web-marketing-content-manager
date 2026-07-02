CREATE TABLE `merchants` (
	`id` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`name` text NOT NULL,
	`logo_url` text NOT NULL,
	`logo_asset_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `merchants_merchant_id_unique` ON `merchants` (`merchant_id`);