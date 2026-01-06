CREATE TABLE "AudioTranscription" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL,
  "runId" text NOT NULL,
  "fileName" text,
  "transcript" text NOT NULL,
  "utterances" jsonb NOT NULL,
  "speakerNames" jsonb NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "AudioTranscription" ADD CONSTRAINT "AudioTranscription_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "AudioTranscription_userId_idx" ON "AudioTranscription" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "AudioTranscription_createdAt_idx" ON "AudioTranscription" USING btree ("createdAt");
