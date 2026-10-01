CREATE TABLE `weaves` (
	`id` text NOT NULL,
	`version` text NOT NULL,
	`digest` text NOT NULL,
	`document` text NOT NULL,
	PRIMARY KEY(`id`, `version`)
);
