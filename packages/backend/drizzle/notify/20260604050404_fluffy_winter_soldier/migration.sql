CREATE TABLE "ConversationBlock" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"blockerId" uuid NOT NULL,
	"blockedId" uuid NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Conversation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"participantA" uuid NOT NULL,
	"participantB" uuid NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Message" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"conversationId" uuid NOT NULL,
	"senderId" uuid NOT NULL,
	"content" text NOT NULL,
	"readAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"recipientId" uuid NOT NULL,
	"actorId" uuid,
	"kind" varchar(64) NOT NULL,
	"sourceUnitId" uuid NOT NULL,
	"extra" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"readAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ConversationBlock_blockerId_blockedId_key" ON "ConversationBlock" ("blockerId","blockedId");--> statement-breakpoint
CREATE INDEX "ConversationBlock_blockerId_idx" ON "ConversationBlock" ("blockerId");--> statement-breakpoint
CREATE INDEX "ConversationBlock_blockedId_idx" ON "ConversationBlock" ("blockedId");--> statement-breakpoint
CREATE UNIQUE INDEX "Conversation_participantA_participantB_key" ON "Conversation" ("participantA","participantB");--> statement-breakpoint
CREATE INDEX "Conversation_participantA_idx" ON "Conversation" ("participantA");--> statement-breakpoint
CREATE INDEX "Conversation_participantB_idx" ON "Conversation" ("participantB");--> statement-breakpoint
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message" ("conversationId","createdAt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "Notification_recipientId_read_idx" ON "Notification" ("recipientId","read");--> statement-breakpoint
CREATE INDEX "Notification_recipientId_kind_sourceUnitId_idx" ON "Notification" ("recipientId","kind","sourceUnitId");--> statement-breakpoint
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification" ("recipientId","createdAt" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;