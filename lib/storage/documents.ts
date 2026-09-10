import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/observability/logger';

const BUCKET_NAME = 'campus-documents';

function getStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey || serviceKey.includes('your-supabase')) {
    logger.error('STORAGE_CONFIG_MISSING', 'Supabase Storage is unconfigured: missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL', {
      details: {
        hasUrl: Boolean(supabaseUrl),
        hasServiceKey: Boolean(serviceKey),
      },
    });
    throw new Error(
      `[STORAGE_CONFIG_MISSING] Supabase Storage credentials (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) are unconfigured or unavailable.`
    );
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Upload document buffer to private Supabase Storage bucket
 */
export async function uploadDocumentToStorage(input: {
  fileBuffer: Buffer;
  mimeType: string;
  storagePath: string;
}): Promise<{ storagePath: string }> {
  const supabase = getStorageClient();

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(input.storagePath, input.fileBuffer, {
      contentType: input.mimeType,
      upsert: true,
    });

  if (error) {
    logger.error('STORAGE_UPLOAD_FAILED', `Failed to upload document to private storage bucket "${BUCKET_NAME}": ${error.message}`, {
      error: error.message,
      details: {
        storagePath: input.storagePath,
        bucket: BUCKET_NAME,
      },
    });

    if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
      throw new Error(`[STORAGE_BUCKET_MISSING] Storage bucket "${BUCKET_NAME}" was not found.`);
    }

    throw new Error(`[STORAGE_UPLOAD_FAILED] Failed to store document in secure storage: ${error.message}`);
  }

  return { storagePath: input.storagePath };
}

/**
 * Create short-lived signed URL for authorized document access (default 1 hour = 3600s)
 */
export async function createSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const supabase = getStorageClient();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    logger.error('STORAGE_SIGNED_URL_FAILED', `Failed to generate signed URL for "${storagePath}": ${error?.message || 'No URL returned'}`, {
      error: error?.message,
      details: {
        storagePath,
        bucket: BUCKET_NAME,
      },
    });

    if (error?.message?.includes('Bucket not found') || error?.message?.includes('not found')) {
      throw new Error(`[STORAGE_BUCKET_MISSING] Storage bucket "${BUCKET_NAME}" was not found.`);
    }

    throw new Error(`[STORAGE_SIGNED_URL_FAILED] Failed to create signed document access URL: ${error?.message || 'Unknown error'}`);
  }

  return data.signedUrl;
}

/**
 * Delete document from private storage bucket
 */
export async function deleteDocumentFromStorage(storagePath: string): Promise<void> {
  const supabase = getStorageClient();
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
  if (error) {
    logger.warn('STORAGE_DELETE_WARN', `Could not delete document from storage (${storagePath}): ${error.message}`, {
      error: error.message,
      details: {
        storagePath,
        bucket: BUCKET_NAME,
      },
    });
  }
}
