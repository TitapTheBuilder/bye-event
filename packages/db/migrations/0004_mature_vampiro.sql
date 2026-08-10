CREATE TABLE "uploads" (
	"path" text PRIMARY KEY NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
