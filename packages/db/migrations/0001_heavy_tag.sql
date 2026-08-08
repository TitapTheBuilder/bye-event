CREATE TABLE "visit_sync_events" (
	"local_id" uuid PRIMARY KEY NOT NULL,
	"exhibitor_id" uuid NOT NULL,
	"visitor_id" uuid NOT NULL,
	"scanned_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visit_sync_events" ADD CONSTRAINT "visit_sync_events_exhibitor_id_exhibitors_id_fk" FOREIGN KEY ("exhibitor_id") REFERENCES "public"."exhibitors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_sync_events" ADD CONSTRAINT "visit_sync_events_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visit_sync_events_exhibitor_id_idx" ON "visit_sync_events" USING btree ("exhibitor_id");--> statement-breakpoint
CREATE INDEX "visit_sync_events_visitor_id_idx" ON "visit_sync_events" USING btree ("visitor_id");