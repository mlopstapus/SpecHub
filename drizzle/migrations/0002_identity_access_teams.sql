CREATE TABLE "identity_access"."teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"owner_id" uuid,
	"parent_team_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_organization_id_slug_unique" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
ALTER TABLE "identity_access"."teams" ADD CONSTRAINT "teams_parent_team_id_teams_id_fk" FOREIGN KEY ("parent_team_id") REFERENCES "identity_access"."teams"("id") ON DELETE no action ON UPDATE no action;