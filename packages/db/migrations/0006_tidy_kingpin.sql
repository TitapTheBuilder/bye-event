CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "exhibitors" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets" USING btree ("expires_at");--> statement-breakpoint
DO $$
DECLARE
  visitor_row record;
  candidate text;
BEGIN
  FOR visitor_row IN
    SELECT "id" FROM "visitors" WHERE "short_code" !~ '^[0-9]{6}$'
  LOOP
    LOOP
      candidate := lpad(floor(random() * 1000000)::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "visitors" WHERE "short_code" = candidate);
    END LOOP;
    UPDATE "visitors" SET "short_code" = candidate WHERE "id" = visitor_row."id";
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "visitors" ALTER COLUMN "short_code" DROP DEFAULT;--> statement-breakpoint
INSERT INTO "event_settings" ("id", "business_name")
VALUES (1, 'Exhibition System')
ON CONFLICT ("id") DO NOTHING;