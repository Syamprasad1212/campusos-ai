# CampusOS AI — Observability & Structured Logging

## 1. Structured Logging Architecture

CampusOS AI utilizes a centralized, structured JSON logging abstraction (`lib/observability/logger.ts`).
Logs are designed for seamless ingestion by Vercel Logs and modern cloud aggregators (Axiom, Datadog, CloudWatch).

---

## 2. Event Types Tracked

| Event Category | Observability Events |
|---|---|
| **Workflow Lifecycle** | `REQUEST_CREATED`, `WORKFLOW_ROUTED`, `TASK_CREATED`, `STATUS_CHANGED` |
| **Approvals** | `APPROVAL_CREATED`, `APPROVAL_COMPLETED` |
| **Notifications** | `NOTIFICATION_CREATED`, `NOTIFICATION_READ` |
| **AI Intelligence** | `AI_REQUEST`, `AI_FALLBACK_USED`, `AI_VALIDATION_FAILED` |
| **Documents** | `DOCUMENT_UPLOADED`, `DOCUMENT_VERIFIED`, `DOCUMENT_REJECTED` |
| **Security & Audits** | `AUTH_FAILURE`, `AUTHORIZATION_DENIED`, `RATE_LIMITED`, `API_ERROR` |

---

## 3. Log Sanitization & PII Safety

The logger automatically inspects and sanitizes all metadata payloads:
- **Redacted Keys**: Passwords, auth tokens, session cookies, database connection strings, `LLM_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and raw file buffers.
- **Client Output**: Internal stack traces and raw SQL errors are stripped from user-facing responses, presenting safe error messages while logging detailed diagnostics to server streams.

---

## 4. Sample Structured Log Output

```json
{
  "level": "INFO",
  "timestamp": "2026-09-10T22:25:30.123Z",
  "event": "REQUEST_CREATED",
  "message": "Request created successfully: req_clx8934j2 (CERTIFICATE_REQUEST)",
  "context": {
    "requestId": "req_clx8934j2",
    "userId": "usr_student_alex",
    "workflowKey": "CERTIFICATE_REQUEST",
    "durationMs": 42
  }
}
```
