# CampusOS AI — System Architecture

## 1. Overview
CampusOS AI is an enterprise operations platform for higher education institutions that coordinates student requests, departmental workflows, document intelligence, multi-tier approvals, and notifications.

### Core Architectural Principle
```
AI = Intelligence & Semantic Extraction
Workflow Engine = Deterministic Source of Truth
Database = Persistent State & Transaction Integrity
RBAC = Authoritative Security Boundary
Human Staff/Admin = Final Authoritative Decision Maker
```

---

## 2. High-Level System Architecture Diagram

```
+-------------------------------------------------------------------------+
|                              CLIENT LAYER                               |
|   Student Portal       |    Staff Operations Queue   |   Admin Portal   |
|   (/dashboard)         |    (/staff/dashboard)       |   (/admin)       |
+-------------------------------------------------------------------------+
                                    │
                                    │ HTTPS (Supabase Auth Session Cookies)
                                    ▼
+-------------------------------------------------------------------------+
|                         APPLICATION & API LAYER                         |
|   - Server-side Session & Identity Derivation (getCurrentAppUser)       |
|   - Rate Limiter (Instance-Local Sliding Window Backpressure)           |
|   - Granular RBAC Engine (canAccessRequest, assertPermission)           |
|   - Standardized API Error Handler (handleApiError)                     |
|   - Centralized Observability & Sanitized Structured Logger             |
+-------------------------------------------------------------------------+
            │                                           │
            ▼                                           ▼
+-----------------------+                   +-----------------------+
|  AI INTELLIGENCE      |                   | DETERMINISTIC ENGINE  |
|  - Gemini 1.5 Pro     |                   | - 13 Workflow Configs |
|  - Provider Adapter   |                   | - State Machine Map   |
|  - Prompt Injection   |                   | - Rule-Based Validator|
|    Defense Layer      |                   | - Idempotency Manager |
|  - Fallback Engine    |                   | - Audit Logger        |
+-----------------------+                   +-----------------------+
            │                                           │
            └───────────────────┬───────────────────────┘
                                │ Controlled Agent Tools (No direct DB access)
                                ▼
+-------------------------------------------------------------------------+
|                            PERSISTENCE LAYER                            |
|   - Supabase PostgreSQL via Prisma ORM (Atomic Transactions)            |
|   - Supabase Storage (Private Buckets + Short-Lived Signed URLs)        |
+-------------------------------------------------------------------------+
```

---

## 3. Component Architecture

### A. Authentication & Server-Side Identity
- **Provider**: Supabase Auth (JWT / Session cookies).
- **Resolver**: `lib/auth/session.ts` (`getCurrentAppUser()`).
- **Enforcement**: Identity, email, role, and department are retrieved exclusively on the server from PostgreSQL. Client-submitted `userId`, `role`, or `departmentId` are rejected/overwritten.

### B. Role-Based Access Control (RBAC)
- **Roles**: `STUDENT`, `FACULTY`, `STAFF`, `DEPARTMENT_ADMIN`, `UNIVERSITY_ADMIN`.
- **Boundaries**:
  - `STUDENT`/`FACULTY`: Constrained strictly to `request.studentId === session.userId`.
  - `STAFF`/`DEPARTMENT_ADMIN`: Constrained strictly to `request.departmentId === session.departmentId`.
  - `UNIVERSITY_ADMIN`: System-wide visibility.
  - **Self-Approval Guard**: `request.studentId !== actor.id` enforced in code.

### C. Deterministic Workflow Engine
- **Source of Truth**: `lib/workflows/definitions.ts` and `lib/workflows/service.ts`.
- **State Machine**: Strict transition table (`ALLOWED_TRANSITIONS`) ensuring requests cannot skip states.
- **Transactions**: Multi-table creations (`Request`, `RequestData`, `Task`, `Approval`, `AuditLog`) executed inside atomic `db.$transaction` blocks.

### D. Controlled Agent Tools Layer
- **Interface**: `lib/agents/tools.ts`.
- Subagents (Intake, Document, Approval, Notification) interact strictly through typed tool contracts. Agents have **zero direct access** to Prisma or PostgreSQL.

---

## 4. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | Server-side rendering, API routes, middleware |
| **Authentication** | Supabase Auth | Secure session management & authentication |
| **Database** | PostgreSQL on Supabase | Relational data persistence & transactional ACID guarantees |
| **ORM** | Prisma 5.22 | Type-safe schema definition and querying |
| **File Storage** | Supabase Storage | Private object store for uploaded student documents |
| **AI Intelligence** | Gemini 1.5 Pro + Fallback | Natural language intake, document analysis, advisory |
| **Styling** | Tailwind CSS + Lucide Icons | Responsive modern enterprise UI |
