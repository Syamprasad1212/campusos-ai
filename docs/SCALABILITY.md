# CampusOS AI — Scalability & Background Processing Strategy

## 1. Current Architecture Performance & Scalability

CampusOS AI is built on a serverless-friendly, modular stack designed for clean vertical and horizontal scalability:
- **Serverless Compute**: Next.js App Router deployed on Vercel with automatic edge/Node scaling.
- **Database Connection Pooling**: Supabase Transaction Pooler (`aws-0-ap-south-1.pooler.supabase.com:5432`) managing high concurrent client connections with low overhead.
- **Query Optimization & Database-Level Filtering**:
  - Direct database-level pagination (`take: 50`, `skip`) prevents oversized memory dumps.
  - Server-side RBAC filtering applied inside `where` clauses (no in-memory post-filtering of unauthorized records).
  - Indexed columns for fast lookups: `Request.studentId`, `Request.departmentId`, `Request.status`, `Request.workflowId`, `Notification.userId`.

---

## 2. Rate Limiting Strategy & Roadmap

### Current Implementation: Instance-Local In-Memory Sliding Window
- **Mechanism**: In-memory timestamp sliding window keyed by `user:${userId}` or `ip:${ip}` (`lib/ratelimit/index.ts`).
- **Scope**: Instance-local protection against rapid bursts, client retry storms, and automated API spamming.
- **Limitations**: On multi-instance serverless deployments, rate-limit state is isolated per instance.

### Scalability Roadmap: Distributed Redis / Upstash Adapter
When platform scale expands to thousands of concurrent requests across multi-region serverless instances:
```
[ Client Request ]
        │
        ▼
[ Rate Limiting Interface (checkRateLimit) ]
        │
        ├── (Current: Local In-Memory Map)
        │
        └── (Future Roadmap: Upstash Redis REST / Redis Cluster)
```
The application code and route handlers remain unchanged, as the rate-limiting interface is fully encapsulated.

---

## 3. Asynchronous & Background Processing Strategy

### Current Architecture: Synchronous Core + Non-Blocking Side Effects
For the current hackathon MVP, keeping the core request pipeline synchronous guarantees immediate feedback and deterministic state:
```
REQUEST ──> VALIDATE ──> PERSIST (db.$transaction) ──> ROUTE
                             │
                             ▼
                 Post-Transaction Non-Blocking Side Effect:
                 notifyWorkflowEvent().catch(...)
```

### Future Architecture: Decoupled Event-Driven Workers
At higher operational scale (e.g., campus-wide rollout to 50,000 students), compute-heavy and I/O-heavy operations will be offloaded to dedicated background workers:

```
[ CampusOS API Layer ]
          │
          │ Emits Event (e.g. REQUEST_SUBMITTED, DOCUMENT_UPLOADED)
          ▼
+─────────────────────────────────────────────+
|   Message Broker / Queue (e.g. Redis/SQS)   |
+─────────────────────────────────────────────+
          │
          ├─────────────────────┬─────────────────────┐
          ▼                     ▼                     ▼
+───────────────────+ +───────────────────+ +───────────────────+
| AI Extraction     | | OCR / Virus Scan  | | Notification      |
| Background Worker | | Background Worker | | Delivery Worker   |
+───────────────────+ +───────────────────+ +───────────────────+
```

### Operations Slated for Asynchronous Workers:
1. **Large Document OCR & Deep Text Extraction**
2. **Batch AI Advisory & Nightly Department Queue Analytics**
3. **Multi-Channel Notification Dispatch** (Email SMTP, SMS, Push notifications)
4. **Historical Telemetry Archiving & Audit Export**
