# CampusOS AI — Enterprise University Workflow & Operations Platform

> **"Describe what you need. CampusOS gets it done."**

CampusOS AI is an enterprise operations platform for higher education institutions that automates student service requests, departmental task routing, document intelligence, multi-tier approvals, and real-time status tracking.

---

## 🏛️ Core Principles

1. **AI = Intelligence**: Natural language understanding, conservative fact extraction, advisory synthesis, and notification drafting.
2. **Workflow Engine = Source of Truth**: 13 configured campus workflows across 5 patterns governing all state transitions.
3. **Database = Transactional Integrity**: ACID-compliant multi-table operations wrapped in Prisma transactions.
4. **RBAC = Security Boundary**: Server-derived identity and granular role/department access boundaries.
5. **Human = Final Authority**: Human staff and department administrators hold exclusive approval/rejection authority.

---

## 👥 Real Demo Accounts (Supabase Auth)

| Role | Name | Email | Password | Department | Primary Portal |
|---|---|---|---|---|---|
| **Student** | Alex Chen | `alex.student@campus.edu` | `CampusOS@2026!` | Computer Science | `/dashboard` |
| **Faculty** | Dr. Sarah Jenkins | `sarah.faculty@campus.edu` | `CampusOS@2026!` | Computer Science | `/dashboard` |
| **Staff** | Mark Davis | `mark.staff@campus.edu` | `CampusOS@2026!` | Registrar Office | `/staff/dashboard` |
| **Staff** | David Miller | `david.staff@campus.edu` | `CampusOS@2026!` | Student Affairs | `/staff/dashboard` |
| **Dept Admin** | Dr. Robert Taylor | `dean.registrar@campus.edu` | `CampusOS@2026!` | Registrar Office | `/admin/dashboard` |
| **Univ Admin** | Dr. Emily Watson | `admin.provost@campus.edu` | `CampusOS@2026!` | Central University | `/admin/dashboard` |

---

## ⚡ Key Features

- **Natural-Language AI Intake**: Aggressive intent inference with strict conservative fact extraction (*never fabricates user facts*).
- **Targeted Missing Field Clarification**: Automatically prompts students only for missing required fields when requests are incomplete.
- **Departmental Work Queue**: Real-time staff queue filtering requests strictly by authorized department.
- **Document Intelligence**: Private Supabase Storage with signed short-lived URLs, file validation, and automated advisory extraction.
- **AI Approval Advisory**: Rule-gated policy verification and risk rating for administrators (*AI cannot mutate state or approve*).
- **Multi-Tier Approvals & Self-Approval Prevention**: Strict enforcement that requesters cannot approve their own submissions.
- **Idempotency & Rate Limiting**: User-scoped request idempotency and instance-local burst protection returning HTTP 429.
- **Audit Logging & Timeline**: Immutable audit events rendered in a unified student timeline.

---

## 📚 Technical Documentation

Detailed documentation is available in the [`docs/`](docs/) directory:
- [System Architecture](docs/ARCHITECTURE.md)
- [End-to-End System Flow](docs/SYSTEM-FLOW.md)
- [Security Threat Model (T1–T12)](docs/SECURITY.md)
- [Responsible AI & Safety](docs/AI-SAFETY.md)
- [Failure Handling & Reliability](docs/FAILURE-HANDLING.md)
- [Observability & Logging](docs/OBSERVABILITY.md)
- [Scalability & Background Processing Strategy](docs/SCALABILITY.md)
- [Deployment & Environment Setup](docs/DEPLOYMENT.md)
- [Known Limitations & Design Boundaries](docs/KNOWN-LIMITATIONS.md)

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Run Test Suite
```bash
npm test
```

### 4. Build Production Bundle
```bash
npm run build
```

### 5. Start Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

