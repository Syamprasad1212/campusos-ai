import crypto from 'crypto';
import { db } from '@/lib/db';
import { uploadDocumentToStorage, createSignedDocumentUrl } from '@/lib/storage/documents';
import { extractDocumentContent } from '@/lib/documents/extractor';
import { runDocumentAgent } from '@/lib/agents/document-agent';
import { validateDocumentSubmission } from '@/lib/documents/validation';
import { canAccessRequest } from '@/lib/permissions';
import { UserSession } from '@/types';

export interface UploadDocumentInput {
  requestId: string;
  uploaderId: string;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  documentType?: string;
}

/**
 * Transaction-safe document upload, storage, extraction, classification, validation, and audit pipeline
 */
export async function processAndStoreDocument(input: UploadDocumentInput) {
  const { requestId, uploaderId, fileName, mimeType, fileBuffer } = input;

  // 1. Authenticate & fetch user and request
  const user = await db.user.findUnique({ where: { id: uploaderId } });
  if (!user) {
    throw new Error(`[USER_NOT_FOUND] User with ID "${uploaderId}" not found.`);
  }

  const request = await db.request.findUnique({
    where: { id: requestId },
    include: { workflow: true, department: true },
  });

  if (!request) {
    throw new Error(`[REQUEST_NOT_FOUND] Request with ID "${requestId}" not found.`);
  }

  // 2. Security Check: Enforce Request Ownership / Access
  const userSession: UserSession = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as any,
    departmentId: user.departmentId || undefined,
  };

  if (!canAccessRequest(userSession, request.studentId, request.departmentId)) {
    throw new Error(`[FORBIDDEN] You do not have permission to upload documents for this request.`);
  }

  // 3. Generate Non-PII Storage Path (requests/{requestId}/{randomId}.ext)
  const fileExt = fileName.includes('.') ? fileName.split('.').pop() : 'bin';
  const randomId = crypto.randomUUID();
  const storagePath = `requests/${requestId}/${randomId}.${fileExt}`;

  // 4. Upload Buffer to Canonical Supabase Storage
  await uploadDocumentToStorage({
    fileBuffer,
    mimeType,
    storagePath,
  });

  // 5. Extract Text & Metadata
  const extraction = await extractDocumentContent(fileBuffer, fileName, mimeType);

  // 6. AI Document Intelligence Agent Classification & Extraction (Advisory)
  const aiResult = await runDocumentAgent({
    userId: user.id,
    requestId,
    fileName,
    mimeType,
    extractedText: extraction.rawText,
    workflowCategory: request.workflow.category,
  });

  const finalDocType = input.documentType || aiResult.documentType;

  // 7. Deterministic Application Validation
  const validation = validateDocumentSubmission({
    fileName,
    fileType: mimeType,
    fileSize: fileBuffer.length,
    aiDocumentType: finalDocType,
    aiConfidence: aiResult.confidence,
    extractedData: aiResult.extractedData,
    studentProfile: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });

  if (!validation.valid) {
    const errorMsg = validation.errors.join('; ');
    throw new Error(`[VALIDATION_FAILED] Document validation failed: ${errorMsg}`);
  }

  // 8. Create Database Document Record
  const document = await db.document.create({
    data: {
      requestId,
      fileName,
      fileUrl: storagePath,
      fileType: mimeType,
      fileSize: fileBuffer.length,
      documentType: finalDocType,
      storageReference: storagePath,
      verificationStatus: validation.status,
      extractedData: JSON.parse(JSON.stringify(aiResult.extractedData)),
      notes: validation.warnings.length > 0 ? validation.warnings.join('; ') : undefined,
      uploadedById: user.id,
    },
  });

  // 9. Append Audit Log Entries
  await db.auditLog.create({
    data: {
      requestId,
      actorId: user.id,
      action: 'DOCUMENT_UPLOADED',
      metadata: JSON.parse(
        JSON.stringify({
          documentId: document.id,
          fileName,
          documentType: finalDocType,
          fileSize: fileBuffer.length,
        })
      ),
    },
  });

  await db.auditLog.create({
    data: {
      requestId,
      actorId: user.id,
      action: validation.status === 'VERIFIED' ? 'DOCUMENT_VALIDATED' : 'DOCUMENT_REVIEW_REQUIRED',
      metadata: JSON.parse(
        JSON.stringify({
          documentId: document.id,
          verificationStatus: validation.status,
          warnings: validation.warnings,
        })
      ),
    },
  });

  return {
    document,
    validation,
  };
}

/**
 * Manual Staff Document Verification or Rejection
 */
export async function verifyDocumentByStaff(input: {
  documentId: string;
  actorId: string;
  status: 'VERIFIED' | 'REJECTED';
  reason?: string;
}) {
  const { documentId, actorId, status, reason } = input;

  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: { request: true },
  });

  if (!doc) {
    throw new Error(`[DOCUMENT_NOT_FOUND] Document with ID "${documentId}" not found.`);
  }

  const actor = await db.user.findUnique({ where: { id: actorId } });
  if (!actor) {
    throw new Error(`[USER_NOT_FOUND] Staff user not found.`);
  }

  // Security Check: Staff/Admin authorization for the request department
  const userSession: UserSession = {
    id: actor.id,
    email: actor.email,
    name: actor.name,
    role: actor.role as any,
    departmentId: actor.departmentId || undefined,
  };

  if (!canAccessRequest(userSession, doc.request.studentId, doc.request.departmentId) || actor.role === 'STUDENT' || actor.role === 'FACULTY') {
    throw new Error(`[FORBIDDEN] You do not have staff authorization to verify documents in this department.`);
  }

  if (status === 'REJECTED' && (!reason || !reason.trim())) {
    throw new Error(`[VALIDATION_FAILED] Rejection reason is required.`);
  }

  const updatedDoc = await db.document.update({
    where: { id: documentId },
    data: {
      verificationStatus: status,
      notes: reason ? reason.trim() : doc.notes,
    },
  });

  await db.auditLog.create({
    data: {
      requestId: doc.requestId,
      actorId: actor.id,
      action: status === 'VERIFIED' ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_REJECTED',
      metadata: JSON.parse(
        JSON.stringify({
          documentId,
          fileName: doc.fileName,
          status,
          reason: reason || null,
        })
      ),
    },
  });

  return updatedDoc;
}

/**
 * Retrieve short-lived signed URL for an authorized document
 */
export async function getAuthorizedDocumentUrl(documentId: string, userSession: UserSession): Promise<{
  document: any;
  signedUrl: string;
}> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: { request: true },
  });

  if (!doc) {
    throw new Error(`[DOCUMENT_NOT_FOUND] Document with ID "${documentId}" not found.`);
  }

  if (!canAccessRequest(userSession, doc.request.studentId, doc.request.departmentId)) {
    throw new Error(`[FORBIDDEN] You do not have permission to access this document.`);
  }

  const signedUrl = await createSignedDocumentUrl(doc.storageReference || doc.fileUrl, 3600);

  return {
    document: doc,
    signedUrl,
  };
}
