# CampusOS AI — Responsible AI & Safety Architecture

## 1. Guiding Principle
```
"INFER INTENT AGGRESSIVELY, BUT INFER FACTS CONSERVATIVELY."
```

The AI subsystem in CampusOS provides natural-language understanding, structured extraction, advisory synthesis, and notification drafting.
However, **all AI output is treated as untrusted data** that must undergo strict deterministic validation before entering the workflow engine.

---

## 2. Capabilities vs. Prohibitions

### What the AI MAY Do:
- **Classify User Intent**: Map natural-language descriptions to one of the 13 defined university workflows.
- **Extract Explicit Facts**: Extract facts explicitly provided or unmistakably implied by the user (e.g., "bona fide certificate" $\rightarrow$ `certificateType: 'Bona Fide'`).
- **Detect Missing Information**: Identify when mandatory fields are omitted.
- **Ask Targeted Clarifications**: Formulate clear, concise questions requesting only the missing required fields.
- **Provide Approval Advisory**: Summarize request details, verify document completion, and assign advisory risk ratings (`LOW`, `MEDIUM`, `HIGH`).
- **Draft Notification Wording**: Generate context-aware, professional messages for workflow events.

### What the AI MUST NEVER Do:
- **Fabricate Facts**: Never invent dates, times, venues, participant counts, unmentioned room numbers, family income, or scholarship schemes.
- **Invent Policies**: Never invent approval prerequisites or document requirements outside the configured workflow definitions.
- **Mutate Database Directly**: The AI has zero direct access to Prisma or PostgreSQL.
- **Approve or Reject Requests**: Approval authority is strictly human-in-the-loop (`DEPARTMENT_ADMIN` / `UNIVERSITY_ADMIN`).
- **Bypass Workflow Steps**: The deterministic workflow engine controls state transitions.

---

## 3. Prompt Injection Defense Architecture

### Layered Protection Pipeline:
```
[ Untrusted User Input ]
        │
        ▼
[ AI System Prompt Hardening ]
  - Directives mandating untrusted data treatment
  - Strict instruction to ignore adversarial directives
        │
        ▼
[ Gemini 1.5 Pro / Fallback Parser ]
  - Generates structured JSON schema output
        │
        ▼
[ Deterministic Application Validator ]
  - Validates workflowKey against WORKFLOW_DEFINITIONS
  - Validates required fields, data types, and enum options
  - Neutralizes prompt injection payloads (e.g. text containing "grant admin" or "bypass approval")
        │
        ▼
[ Controlled Agent Tools Layer ]
  - Enforces session identity and RBAC boundaries
        │
        ▼
[ Transactional Database Engine ]
```

---

## 4. AI Provider Failure & Fallback Resilience

If external Gemini LLM calls fail, time out, encounter rate limits, or return malformed JSON:
1. The AI Provider (`lib/ai/provider.ts`) intercepts the error and logs an `AI_FALLBACK_USED` observability event.
2. The request automatically delegates to the deterministic local intelligence parser.
3. The local engine uses rule-based semantic matching across all 13 workflow categories without fabricating user facts.
4. If the intent is ambiguous or confidence is $< 0.60$, the system safely defaults to `nextAction = 'CLARIFY'`, asking the student to rephrase.
