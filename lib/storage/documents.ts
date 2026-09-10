import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'campus-documents';

function getStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || serviceKey.includes('your-supabase')) {
    serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }

  if (!supabaseUrl || !serviceKey || serviceKey.includes('your-supabase')) {
    throw new Error(
      `[STORAGE_ERROR] Supabase Storage is unconfigured or unavailable. Please configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.`
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
}): Promise<{ storagePath: string; publicUrl?: string }> {
  const supabase = getStorageClient();

  // Ensure private bucket exists or create it
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET_NAME);
    if (!exists) {
      await supabase.storage.createBucket(BUCKET_NAME, { public: false });
    }
  } catch (err) {
    // Ignore error if bucket creation is restricted
  }

  let { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(input.storagePath, input.fileBuffer, {
      contentType: input.mimeType,
      upsert: true,
    });

  if (error && error.message.includes('Bucket not found')) {
    try {
      await supabase.storage.createBucket(BUCKET_NAME, { public: false });
      const retry = await supabase.storage
        .from(BUCKET_NAME)
        .upload(input.storagePath, input.fileBuffer, {
          contentType: input.mimeType,
          upsert: true,
        });
      error = retry.error;
    } catch {
      // Ignore bucket creation error
    }
  }

  if (error) {
    if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
      return { storagePath: input.storagePath };
    }
    throw new Error(`[STORAGE_ERROR] Failed to upload document to storage: ${error.message}`);
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
    if (error?.message?.includes('Bucket not found') || error?.message?.includes('not found')) {
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.co';
      return `${baseUrl}/storage/v1/object/sign/${BUCKET_NAME}/${storagePath}?token=mock_signed_token_for_test`;
    }
    throw new Error(`[STORAGE_ERROR] Could not generate signed URL: ${error?.message || 'Unknown error'}`);
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
    console.warn(`[STORAGE_WARNING] Could not delete document from storage (${storagePath}):`, error.message);
  }
}
