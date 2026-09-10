# CampusOS AI — Known Limitations & Design Boundaries

CampusOS AI is transparent about its current design choices, architectural boundaries, and scope:

---

## 1. Current Architectural Boundaries

### 1. Instance-Local Rate Limiting
- **Current State**: Rate limiting utilizes an in-memory timestamp sliding window (`lib/ratelimit/index.ts`).
- **Limitation**: Effective for per-instance abuse mitigation and rapid burst backpressure, but rate-limit counters are not globally shared across multiple separate serverless instances.
- **Mitigation / Roadmap**: For enterprise multi-region scale, plug in a distributed Redis/Upstash adapter behind the existing `checkRateLimit()` interface.

### 2. Synchronous AI Intake & Processing
- **Current State**: AI Intake classification and field extraction are executed synchronously during the user request flow.
- **Limitation**: Large prompt payloads or upstream Gemini latency directly impact API response time (typical response time is 200–800ms).
- **Mitigation / Roadmap**: If upstream latency exceeds acceptable thresholds, the architecture is designed to offload extraction to an asynchronous job queue.

### 3. In-App Notifications (No Live External SMTP)
- **Current State**: Notifications are stored in PostgreSQL and delivered live within the in-app notification center.
- **Limitation**: External email dispatch (via SendGrid/AWS SES) or SMS gateways are not active in this hackathon deployment.
- **Mitigation / Roadmap**: The notification service already resolves recipient user IDs and produces structured wording, ready to plug into an SMTP provider.

### 4. Deterministic 13 Campus Workflow Set
- **Current State**: 13 comprehensive higher-education workflows are hardcoded in `lib/workflows/definitions.ts`.
- **Limitation**: Adding novel workflows requires registering definitions in `definitions.ts` rather than dynamic runtime configuration via a visual workflow builder UI.
- **Mitigation / Roadmap**: The database schema includes a `configJson` column on `Workflow` to support dynamic runtime workflow builders in future stages.
