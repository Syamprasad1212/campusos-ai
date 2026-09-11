-- CreateIndex
CREATE INDEX IF NOT EXISTS "Request_studentId_createdAt_idx" ON "Request"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Request_departmentId_createdAt_idx" ON "Request"("departmentId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Request_status_createdAt_idx" ON "Request"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Request_createdAt_idx" ON "Request"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_requestId_status_idx" ON "Task"("requestId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Approval_requestId_stepOrder_idx" ON "Approval"("requestId", "stepOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Approval_approverId_idx" ON "Approval"("approverId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_requestId_verificationStatus_idx" ON "Document"("requestId", "verificationStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_uploadedById_idx" ON "Document"("uploadedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_requestId_createdAt_idx" ON "AuditLog"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentRun_requestId_createdAt_idx" ON "AgentRun"("requestId", "createdAt");
