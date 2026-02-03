CREATE TABLE "Team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"createdByEmail" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TeamMember" (
	"teamId" uuid NOT NULL,
	"userEmail" varchar(256) NOT NULL,
	"role" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdByEmail" text NOT NULL,
	CONSTRAINT "TeamMember_teamId_userEmail_pk" PRIMARY KEY("teamId","userEmail")
);
--> statement-breakpoint
CREATE TABLE "TeamTranscriptRule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamId" uuid NOT NULL,
	"type" varchar NOT NULL,
	"value" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdByEmail" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TeamTranscriptShare" (
	"teamId" uuid NOT NULL,
	"transcriptId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdByEmail" text NOT NULL,
	CONSTRAINT "TeamTranscriptShare_teamId_transcriptId_pk" PRIMARY KEY("teamId","transcriptId")
);
--> statement-breakpoint
CREATE TABLE "TranscriptShare" (
	"transcriptId" integer NOT NULL,
	"userEmail" varchar(256) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdByEmail" text NOT NULL,
	CONSTRAINT "TranscriptShare_transcriptId_userEmail_pk" PRIMARY KEY("transcriptId","userEmail")
);
--> statement-breakpoint
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TeamTranscriptRule" ADD CONSTRAINT "TeamTranscriptRule_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TeamTranscriptShare" ADD CONSTRAINT "TeamTranscriptShare_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Team_createdByEmail_idx" ON "Team" USING btree ("createdByEmail");--> statement-breakpoint
CREATE INDEX "TeamMember_userEmail_idx" ON "TeamMember" USING btree ("userEmail");--> statement-breakpoint
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "TeamTranscriptRule_teamId_idx" ON "TeamTranscriptRule" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "TeamTranscriptShare_teamId_idx" ON "TeamTranscriptShare" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "TeamTranscriptShare_transcriptId_idx" ON "TeamTranscriptShare" USING btree ("transcriptId");--> statement-breakpoint
CREATE INDEX "TranscriptShare_userEmail_idx" ON "TranscriptShare" USING btree ("userEmail");--> statement-breakpoint
CREATE INDEX "TranscriptShare_transcriptId_idx" ON "TranscriptShare" USING btree ("transcriptId");