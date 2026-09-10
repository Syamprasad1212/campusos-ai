import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: ApiErrorCode;
  details?: unknown;
}

export class AppError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code: ApiErrorCode = 'INTERNAL_ERROR', statusCode: number = 500, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function createErrorResponse(
  message: string,
  code: ApiErrorCode = 'INTERNAL_ERROR',
  statusCode: number = 500,
  details?: unknown,
  headers?: HeadersInit
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
      details,
    },
    {
      status: statusCode,
      headers,
    }
  );
}

export function handleApiError(error: unknown, fallbackMessage = 'An unexpected error occurred'): NextResponse<ApiErrorResponse> {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('[FORBIDDEN]') || message.toLowerCase().includes('permission') || message.toLowerCase().includes('unauthorized')) {
    return createErrorResponse(
      message.replace(/^\[FORBIDDEN\]\s*/, ''),
      'FORBIDDEN',
      403
    );
  }

  if (message.includes('[UNAUTHENTICATED]') || message.toLowerCase().includes('unauthenticated')) {
    return createErrorResponse(
      message.replace(/^\[UNAUTHENTICATED\]\s*/, ''),
      'UNAUTHENTICATED',
      401
    );
  }

  if (
    message.includes('[NOT_FOUND]') ||
    message.includes('[REQUEST_NOT_FOUND]') ||
    message.includes('[USER_NOT_FOUND]') ||
    message.includes('[DOCUMENT_NOT_FOUND]') ||
    message.includes('[WORKFLOW_NOT_FOUND]')
  ) {
    return createErrorResponse(
      message.replace(/^\[[A-Z_]+\]\s*/, ''),
      'NOT_FOUND',
      404
    );
  }

  if (
    message.includes('[VALIDATION_FAILED]') ||
    message.includes('[INVALID_ACTION]') ||
    message.includes('[INVALID_STEP]') ||
    message.includes('[INVALID_TRANSITION]') ||
    message.includes('[AGENT_SECURITY_VIOLATION]')
  ) {
    return createErrorResponse(
      message.replace(/^\[[A-Z_]+\]\s*/, ''),
      'VALIDATION_ERROR',
      400
    );
  }

  if (message.includes('[RATE_LIMITED]')) {
    return createErrorResponse(
      message.replace(/^\[RATE_LIMITED\]\s*/, ''),
      'RATE_LIMITED',
      429
    );
  }

  if (message.includes('[CONFLICT]')) {
    return createErrorResponse(
      message.replace(/^\[CONFLICT\]\s*/, ''),
      'CONFLICT',
      409
    );
  }

  // Generic fallback (prevent leaking raw DB query traces to clients)
  const clientSafeMessage = process.env.NODE_ENV === 'production' && !message.startsWith('[')
    ? fallbackMessage
    : message;

  return createErrorResponse(clientSafeMessage, 'INTERNAL_ERROR', 500);
}
