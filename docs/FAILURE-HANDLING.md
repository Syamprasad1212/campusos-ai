# CampusOS AI — Failure Handling & Reliability Strategy

## 1. Overview
CampusOS AI is built to fail safely and predictably. Unhandled exceptions, network timeouts, or external service interruptions do not corrupt database state or leave requests in orphaned limbo.

---

## 2. Failure Scenarios & Mitigations

### 1. Database Transaction Rollback
- **Scenario**: A crash occurs while creating a request, after inserting the `Request` row but before `RequestData` or `Task` rows are inserted.
- **Handling**: All multi-table operations execute within `db.$transaction()`. If any step throws, PostgreSQL issues a complete `ROLLBACK`. No partial rows remain.

### 2. External LLM Outage / Rate Limiting
- **Scenario**: Gemini API is unreachable, times out, or returns HTTP 429.
- **Handling**: Caught in `generateStructuredResponse()`. Automatically switches to the deterministic local semantic parser. No user disruption; fallback logged via `logger.warn('AI_FALLBACK_USED')`.

### 3. Notification Engine Interruption
- **Scenario**: Notification wording generation or database notification insertion fails.
- **Handling**: Notifications run as non-blocking post-transaction side effects (`notifyWorkflowEvent().catch(...)`). A failure to send a notification will **never** rollback a successful workflow state transition.

### 4. Idempotent Retry Handling
- **Scenario**: Client experiences network latency and sends duplicate POST requests.
- **Handling**:
  - Request creation: User-scoped idempotency key (`user_${userId}:${idempotencyKey}`) checks for existing recent submission and safely returns the existing record.
  - Approvals: Unique database constraint on `Approval.idempotencyKey` prevents duplicate approval records for the same step.
  - Notifications: Unique database constraint on `Notification.idempotencyKey` prevents duplicate notification records for the same event.

### 5. Document Upload Interruption
- **Scenario**: Supabase storage upload succeeds but metadata extraction fails.
- **Handling**: Document records are only inserted after successful storage confirmation and validation. If extraction fails, deterministic validation falls back to `NEEDS_REVIEW` requiring manual staff signoff.
