ALTER TABLE "visitors" ADD COLUMN "short_code" varchar(10) NOT NULL;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_short_code_unique" UNIQUE("short_code");