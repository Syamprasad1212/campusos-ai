/**
 * CampusOS Rate Limiting Service
 * 
 * ARCHITECTURE & SCALABILITY NOTE:
 * Current rate limiting is instance-local (in-memory sliding window).
 * It provides effective abuse and rapid-burst backpressure protection
 * for the current serverless deployment without adding heavy external
 * infrastructure (e.g. Redis).
 * 
 * ROADMAP:
 * At higher scale across multiple globally distributed serverless instances,
 * replace the internal storage adapter with a distributed store (e.g. Redis/Upstash)
 * without altering the calling interface.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodically clean up stale rate-limit keys to avoid memory leaks
const CLEANUP_INTERVAL_MS = 60000;
let lastCleanup = Date.now();

function cleanupStaleRecords(now: number, maxWindowMs: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  rateLimitStore.forEach((record: RateLimitRecord, key: string) => {
    record.timestamps = record.timestamps.filter((t: number) => now - t < maxWindowMs);
    if (record.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  });
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in ms when the window resets
}

export interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
}

/**
 * Check if a given identifier exceeds the allowed rate limit
 * 
 * @param identifier Unique key (e.g. `user:${userId}` or `ip:${ip}`)
 * @param options Limit and windowMs configuration
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? 30; // Default: 30 requests
  const windowMs = options.windowMs ?? 60000; // Default: per 1 minute (60s)
  const now = Date.now();

  cleanupStaleRecords(now, windowMs);

  let record = rateLimitStore.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(identifier, record);
  }

  // Filter timestamps within the current sliding window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= limit) {
    const oldestTimestamp = record.timestamps[0] || now;
    const reset = oldestTimestamp + windowMs;
    return {
      success: false,
      limit,
      remaining: 0,
      reset,
    };
  }

  // Record this request
  record.timestamps.push(now);

  return {
    success: true,
    limit,
    remaining: limit - record.timestamps.length,
    reset: now + windowMs,
  };
}

/**
 * Helper to extract client identifier (User ID or IP address) from Request
 */
export function getClientIdentifier(req: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const clientIp = forwardedFor.split(',')[0].trim();
    return `ip:${clientIp}`;
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return `ip:${realIp.trim()}`;
  }

  return 'ip:127.0.0.1';
}

/**
 * Pre-configured rate limits for specific sensitive operations
 */
export const RATE_LIMIT_CONFIGS = {
  // AI intake: 20 calls per minute per user/IP
  AI_INTAKE: { limit: 20, windowMs: 60000 },
  // Request creation: 15 submissions per minute per user
  REQUEST_CREATION: { limit: 15, windowMs: 60000 },
  // Document upload: 20 uploads per minute per user
  DOCUMENT_UPLOAD: { limit: 20, windowMs: 60000 },
  // Approvals & actions: 30 actions per minute per staff member
  WORKFLOW_ACTION: { limit: 30, windowMs: 60000 },
};

/**
 * Helper for unit tests to reset the rate limiter store
 */
export function _resetRateLimitStore(): void {
  rateLimitStore.clear();
}
