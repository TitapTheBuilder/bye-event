ALTER TABLE "exhibitors" ALTER COLUMN "first_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "exhibitors" ALTER COLUMN "last_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "exhibitors" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "visitors" DROP COLUMN "name";