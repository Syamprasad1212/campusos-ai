/**
 * CampusOS Centralized Observability & Structured Logging
 * 
 * OBSERVABILITY PRINCIPLES:
 * 1. Structured JSON logging compatible with Vercel and cloud log aggregators.
 * 2. Strict sanitization: NEVER log passwords, tokens, API keys, service-role keys, or full document contents.
 * 3. Track key lifecycle, security, AI, and workflow events across the system.
 */

export type ObservabilityEvent =
  | 'REQUEST_CREATED'
  | 'WORKFLOW_ROUTED'
  | 'TASK_CREATED'
  | 'APPROVAL_CREATED'
  | 'APPROVAL_COMPLETED'
  | 'STATUS_CHANGED'
  | 'NOTIFICATION_CREATED'
  | 'NOTIFICATION_READ'
  | 'AI_REQUEST'
  | 'AI_FALLBACK_USED'
  | 'AI_VALIDATION_FAILED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_VERIFIED'
  | 'DOCUMENT_REJECTED'
  | 'STORAGE_CONFIG_MISSING'
  | 'STORAGE_UPLOAD_FAILED'
  | 'STORAGE_SIGNED_URL_FAILED'
  | 'STORAGE_DELETE_WARN'
  | 'AUTH_FAILURE'
  | 'AUTHORIZATION_DENIED'
  | 'API_ERROR'
  | 'RATE_LIMITED';

export interface LogContext {
  requestId?: string;
  userId?: string;
  userRole?: string;
  departmentCode?: string;
  workflowKey?: string;
  action?: string;
  durationMs?: number;
  statusCode?: number;
  error?: string;
  details?: Record<string, unknown>;
}

// Redact sensitive patterns from log data
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'llm_api_key',
  'supabase_service_role_key',
  'database_url',
  'filebuffer',
]);

function sanitizeLogData(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeLogData);

  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = k.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('token') || lowerKey.includes('password')) {
      sanitized[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      sanitized[k] = sanitizeLogData(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

export const logger = {
  info(event: ObservabilityEvent, message: string, context?: LogContext) {
    const payload = {
      level: 'INFO',
      timestamp: new Date().toISOString(),
      event,
      message,
      context: context ? sanitizeLogData(context) : undefined,
    };
    console.log(JSON.stringify(payload));
  },

  warn(event: ObservabilityEvent, message: string, context?: LogContext) {
    const payload = {
      level: 'WARN',
      timestamp: new Date().toISOString(),
      event,
      message,
      context: context ? sanitizeLogData(context) : undefined,
    };
    console.warn(JSON.stringify(payload));
  },

  error(event: ObservabilityEvent, message: string, context?: LogContext) {
    const payload = {
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      event,
      message,
      context: context ? sanitizeLogData(context) : undefined,
    };
    console.error(JSON.stringify(payload));
  },

  security(event: ObservabilityEvent, message: string, context?: LogContext) {
    const payload = {
      level: 'SECURITY_ALERT',
      timestamp: new Date().toISOString(),
      event,
      message,
      context: context ? sanitizeLogData(context) : undefined,
    };
    console.warn(JSON.stringify(payload));
  },
};
