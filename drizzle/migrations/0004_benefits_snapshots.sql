CREATE TABLE `benefits_snapshots` (
	`month` text PRIMARY KEY NOT NULL,
	`data_json` text NOT NULL,
	`pushed_by` text,
	`updated_at` integer NOT NULL
);
