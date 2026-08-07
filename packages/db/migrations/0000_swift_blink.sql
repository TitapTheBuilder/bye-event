CREATE TYPE "public"."visitor_type" AS ENUM('invited', 'guest');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" varchar(200) NOT NULL,
	"email" varchar(200) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "event_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"business_name" varchar(200),
	"logo_url" text,
	"primary_color" varchar(7),
	"secondary_color" varchar(7),
	"accent_color" varchar(7),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exhibitors" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" varchar(200) NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" text NOT NULL,
	"phone_number" varchar(30) NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exhibitors_username_unique" UNIQUE("username"),
	CONSTRAINT "exhibitors_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"qr_token" varchar(64) NOT NULL,
	"name" varchar(200),
	"company" varchar(200),
	"phone_number" varchar(30),
	"email" varchar(200),
	"visitor_type" "visitor_type" DEFAULT 'invited' NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitors_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"exhibitor_id" uuid NOT NULL,
	"visitor_id" uuid NOT NULL,
	"scan_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visits_exhibitor_id_visitor_id_pk" PRIMARY KEY("exhibitor_id","visitor_id")
);
--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_exhibitor_id_exhibitors_id_fk" FOREIGN KEY ("exhibitor_id") REFERENCES "public"."exhibitors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visitors_deactivated_at_idx" ON "visitors" USING btree ("deactivated_at");--> statement-breakpoint
CREATE INDEX "visits_visitor_id_idx" ON "visits" USING btree ("visitor_id");