# CampusOS AI — End-to-End System Flow

## 1. Complete Request Lifecycle Flow

```
[ Student ]
    │
    │ 1. Natural Language Prompt ("I need a bonafide certificate for an education loan")
    ▼
[ AI Intake Agent ] ──> Provider / Fallback
    │
    │ 2. Intent matched to CERTIFICATE_REQUEST (Conservative fact extraction)
    ▼
[ Deterministic Workflow Preview ]
    │
    │ 3. Student reviews structured fields & confirms submission
    ▼
[ POST /api/ai/intake/confirm ] (Scoped Idempotency + Rate Limiting)
    │
    │ 4. Atomic Prisma Transaction:
    │    - Create Request (Status: SUBMITTED, Step 1)
    │    - Create RequestData (FormData + Idempotency metadata)
    │    - Create Task (Assigned to department queue)
    │    - Create AuditLog (REQUEST_CREATED)
    ▼
[ Non-Blocking Notification ] ──> Student confirmation & Staff queue alert
    │
    ▼
[ Staff Operations Work Queue (/staff/dashboard) ]
    │
    │ 5. Staff member opens request in authorized department
    │ 6. Staff verifies documents or requests additional info
    ▼
[ POST /api/requests/[id]/actions ] (Action: APPROVE / COMPLETE_STEP)
    │
    │ 7. Gating Check: Required documents must be VERIFIED
    │ 8. Advance request to Step 2 (Status: APPROVAL_PENDING)
    │ 9. Auto-create pending Approval record
    ▼
[ Department Admin Review (/admin/dashboard) ]
    │
    │ 10. Admin views AI Approval Advisory (Policy check, risk rating)
    │ 11. Admin executes human approval decision (Self-approval prevented)
    ▼
[ Request Status: COMPLETED ]
    │
    │ 12. Final audit log recorded & student notification delivered
    ▼
[ Student Timeline Updated ]
```

---

## 2. Document Intelligence & Verification Flow

1. **Upload**: Student uploads document (`multipart/form-data`) via `/api/requests/[id]/documents`.
2. **Security & Format Validation**:
   - MIME type verified (PDF, PNG, JPEG allowed; executable `.exe` / scripts rejected).
   - Size limit strictly enforced (< 10 MB).
   - Storage path generated using opaque UUIDs (`requests/{requestId}/{randomId}.ext`) to prevent PII leakage.
3. **Storage**: Buffer uploaded to private Supabase Storage bucket.
4. **Extraction & Advisory Classification**: Text extracted and analyzed by AI Document Agent.
5. **Deterministic Verification Status**:
   - If document matches student name/ID with high confidence: marked `VERIFIED`.
   - If mismatch or low confidence: marked `NEEDS_REVIEW` (blocks workflow step completion until staff signoff).
6. **Access Control**: Short-lived signed URLs generated on-demand only for authorized students and department staff.

---

## 3. Human-in-the-Loop Approval Flow

1. When a workflow step specifies `requiresApproval: true` or `roleRequired: DEPARTMENT_ADMIN`:
   - Request transitions to `APPROVAL_PENDING`.
   - A unique `Approval` record is initialized with status `PENDING`.
2. **AI Advisory Role**:
   - The AI Approval Agent inspects verified documents and workflow field completeness.
   - Outputs a risk rating (`LOW`, `MEDIUM`, `HIGH`) and key insights.
   - **Crucial Rule**: The AI advisory *cannot* mutate database state or approve the request.
3. **Human Decision**:
   - Authorized Department Admin or University Admin reviews the advisory and clicks Approve/Reject.
   - Server checks `request.studentId !== actor.id` to prevent self-approval.
   - Upon approval, the `Approval` record is stamped with `approverId`, `status: APPROVED`, and timestamp.
