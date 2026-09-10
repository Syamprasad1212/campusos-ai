# CampusOS AI — Deployment & Environment Guide

## 1. Production Deployment on Vercel

CampusOS AI is configured for one-click continuous deployment from GitHub main to Vercel.

### Build Pipeline:
1. `postinstall`: Runs `prisma generate` to ensure Prisma Client bindings match the runtime environment.
2. `build`: Executes `next build` to compile the TypeScript codebase into optimized serverless edge/Node bundles.

---

## 2. Environment Variables Configuration

| Variable Name | Environment | Description | Example / Note |
|---|---|---|---|
| `DATABASE_URL` | Server-Only | Supabase PostgreSQL pooled connection URL | `postgresql://postgres.[ref]:[pwd]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?pgbouncer=true` |
| `DIRECT_URL` | Server-Only | Supabase direct database connection for migrations | `postgresql://postgres:[pwd]@db.[ref].supabase.co:5432/postgres` |
| `NEXT_PUBLIC_SUPABASE_URL` | Public / Browser | Supabase project API endpoint | `https://[ref].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public / Browser | Supabase anonymous API key | Standard client anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-Only | Supabase service-role administrative key | **Never expose to browser** |
| `SUPABASE_STORAGE_BUCKET` | Server-Only | Storage bucket name for documents | `campus-documents` (Private bucket) |
| `LLM_API_KEY` | Server-Only | Google Gemini API key | Optional (defaults gracefully to fallback parser) |
| `LLM_MODEL` | Server-Only | Gemini model identifier | `gemini-1.5-pro` |

---

## 3. Storage Bucket Configuration

- **Bucket Name**: `campus-documents`
- **Visibility**: **Private** (Public access disabled).
- **Access Pattern**: Handled server-side through signed URLs (`createSignedDocumentUrl()`) valid for 3600 seconds (1 hour).

---

## 4. Database Seed & Initial Provisioning

To seed the initial configuration and demo accounts:
```bash
npx prisma db seed
```
> [!NOTE]
> The database seed script provisions only department metadata, workflow definitions, and the 6 demo user accounts. It **never** inserts synthetic request records into the production database.
