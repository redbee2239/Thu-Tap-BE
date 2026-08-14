CREATE TABLE "TaskCompletion" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskCompletion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskCompletion_taskId_completedAt_idx" ON "TaskCompletion"("taskId", "completedAt");
CREATE INDEX "TaskCompletion_confirmedById_idx" ON "TaskCompletion"("confirmedById");

ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
