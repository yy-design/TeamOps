CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "userInput" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "conversationId" TEXT,
    "requestedById" TEXT NOT NULL,
    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentStep" (
    "id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "toolName" TEXT,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "runId" TEXT NOT NULL,
    CONSTRAINT "AgentStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ToolApproval" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "proposal" JSONB NOT NULL,
    "preview" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "reason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "resolvedById" TEXT,
    "resultSprintId" TEXT,
    CONSTRAINT "ToolApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentStep_runId_sequence_key" ON "AgentStep"("runId", "sequence");
CREATE INDEX "AgentStep_runId_status_idx" ON "AgentStep"("runId", "status");
CREATE INDEX "AgentRun_conversationId_startedAt_idx" ON "AgentRun"("conversationId", "startedAt");
CREATE INDEX "AgentRun_requestedById_status_idx" ON "AgentRun"("requestedById", "status");
CREATE UNIQUE INDEX "ToolApproval_idempotencyKey_key" ON "ToolApproval"("idempotencyKey");
CREATE UNIQUE INDEX "ToolApproval_resultSprintId_key" ON "ToolApproval"("resultSprintId");
CREATE INDEX "ToolApproval_requestedById_status_idx" ON "ToolApproval"("requestedById", "status");
CREATE INDEX "ToolApproval_runId_status_idx" ON "ToolApproval"("runId", "status");

ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentStep" ADD CONSTRAINT "AgentStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolApproval" ADD CONSTRAINT "ToolApproval_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolApproval" ADD CONSTRAINT "ToolApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ToolApproval" ADD CONSTRAINT "ToolApproval_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ToolApproval" ADD CONSTRAINT "ToolApproval_resultSprintId_fkey" FOREIGN KEY ("resultSprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
