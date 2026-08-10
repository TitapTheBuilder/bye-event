ALTER TABLE "exhibitors" ADD COLUMN "first_name" varchar(200);--> statement-breakpoint
ALTER TABLE "exhibitors" ADD COLUMN "last_name" varchar(200);--> statement-breakpoint
ALTER TABLE "visitors" ADD COLUMN "first_name" varchar(200);--> statement-breakpoint
ALTER TABLE "visitors" ADD COLUMN "last_name" varchar(200);--> statement-breakpoint
UPDATE "exhibitors"
SET "first_name" = COALESCE(NULLIF(BTRIM("name"), ''), ''), "last_name" = ''
WHERE "first_name" IS NULL;--> statement-breakpoint
UPDATE "visitors"
SET "first_name" = NULLIF(BTRIM("name"), '')
WHERE "first_name" IS NULL AND "name" IS NOT NULL;