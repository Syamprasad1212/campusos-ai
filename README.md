# CampusOS AI

> **"Describe what you need. CampusOS gets it done."**

CampusOS AI is an AI-powered university and campus workflow automation platform. It simplifies student and faculty requests by automatically matching natural language intents to configured campus workflows, routing them to the correct university department, creating staff action tasks, managing human reviews/approvals, and enabling real-time completion tracking.

---

## 🏗️ Architecture Status (Stage 1 - Foundation)

| Component | Status | Details |
| :--- | :--- | :--- |
| **Foundation Layout & Navigation Shell** | **Implemented** | Next.js 14 App Router, TypeScript, Tailwind CSS, Lucide React icons |
| **Student Portal Shell** | **Implemented** | Natural language request prompt preview & active request tracking |
| **Staff Portal Shell** | **Implemented** | Departmental work queue UI shell & action table |
| **Admin Portal Shell** | **Implemented** | University administration dashboard & workflow definition registry |
| **Prisma Schema & Core Entities** | **Implemented** | Models for User, Department, Workflow, WorkflowStep, Request, RequestData, Task, Approval, Document, Notification, AuditLog, AgentRun |
| **Server-Side Authorization Boundaries** | **Implemented** | Role-based permission helpers (`STUDENT`, `FACULTY`, `STAFF`, `DEPARTMENT_ADMIN`, `UNIVERSITY_ADMIN`) |
| **Workflow Configuration Registry** | **Implemented** | Data-driven definition templates for 13 campus workflows across 5 patterns |
| **AI Service Abstraction Stub** | **Implemented** | Read-only intent classification contract (enforces AI schema validation & non-mutation rule) |
| **Workflow Engine & Execution** | *Planned (Stage 2)* | Dynamic step execution, automated routing logic |
| **AI Agent & LLM Tool Calling** | *Planned (Stage 3)* | External LLM API integration with structured JSON output schemas |

---

## 🛠️ Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Database & ORM**: PostgreSQL & Prisma ORM
- **Authentication**: Supabase Auth / NextAuth integration ready
- **Environment**: `.env` driven secrets management

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` before running the project:

```bash
# Database (PostgreSQL / Supabase)
DATABASE_URL="postgresql://postgres:password@localhost:5432/campusos_ai?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/campusos_ai?schema=public"

# Auth (Supabase Auth / NextAuth)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# AI Service (External LLM API)
LLM_API_KEY="your-llm-api-key"
LLM_MODEL="gemini-1.5-pro"
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Validate Prisma Schema & Generate Client
```bash
npx prisma validate
npx prisma generate
```

### 3. Type Checking
```bash
npx tsc --noEmit
```

### 4. Build Project
```bash
npm run build
```

### 5. Run Development Server
```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 📐 Project Structure

```
campusos-ai/
├── app/
│   ├── (admin)/
│   │   ├── dashboard/page.tsx
│   │   └── layout.tsx
│   ├── (staff)/
│   │   ├── dashboard/page.tsx
│   │   └── layout.tsx
│   ├── (student)/
│   │   ├── dashboard/page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   └── health/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── ui/
│       └── navigation.tsx
├── lib/
│   ├── ai/index.ts
│   ├── db/index.ts
│   ├── permissions/index.ts
│   └── workflows/definitions.ts
├── prisma/
│   └── schema.prisma
├── types/
│   └── index.ts
├── .env.example
├── .env
├── package.json
├── README.md
├── tailwind.config.js
└── tsconfig.json
```
