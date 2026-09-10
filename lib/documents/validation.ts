export interface DeterministicValidationResult {
  valid: boolean;
  status: 'VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED';
  errors: string[];
  warnings: string[];
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit

/**
 * Deterministic application-level document validator
 */
export function validateDocumentSubmission(input: {
  fileName: string;
  fileType: string;
  fileSize: number;
  aiDocumentType?: string;
  aiConfidence?: number;
  extractedData?: Record<string, unknown>;
  studentProfile?: {
    id: string;
    name: string;
    email: string;
  };
}): DeterministicValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. File Type Check
  const lowerType = (input.fileType || '').toLowerCase();
  const lowerName = (input.fileName || '').toLowerCase();

  const isExecutable = lowerName.endsWith('.exe') || lowerName.endsWith('.sh') || lowerName.endsWith('.bat') || lowerName.endsWith('.cmd') || lowerName.endsWith('.js');
  if (isExecutable) {
    errors.push('Executable files are strictly prohibited.');
    return { valid: false, status: 'REJECTED', errors, warnings };
  }

  const isValidType = ALLOWED_MIME_TYPES.some((mime) => lowerType.includes(mime)) ||
    lowerName.endsWith('.pdf') || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg');

  if (!isValidType) {
    errors.push('Unsupported file type. Only PDF, PNG, and JPG/JPEG files are accepted.');
    return { valid: false, status: 'REJECTED', errors, warnings };
  }

  // 2. File Size Check
  if (input.fileSize > MAX_FILE_SIZE_BYTES) {
    errors.push('File size exceeds maximum allowed limit of 10 MB.');
    return { valid: false, status: 'REJECTED', errors, warnings };
  }

  // 3. AI Confidence & Advisory Checks
  let finalStatus: 'VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED' = 'NEEDS_REVIEW';

  if ((input.aiConfidence ?? 0) < 0.60) {
    warnings.push('Low AI classification confidence. Manual staff verification required.');
  }

  // 4. Student ID Profile Cross-Matching
  if (input.extractedData && input.studentProfile) {
    const extractedId = String(input.extractedData.studentId || '').trim().toLowerCase();
    const extractedName = String(input.extractedData.studentName || '').trim().toLowerCase();
    const profileName = input.studentProfile.name.toLowerCase();

    if (extractedId && extractedId.length > 3) {
      // Check if extracted student ID matches expected pattern
      if (!profileName.includes(extractedName) && !extractedName.includes(profileName.split(' ')[0])) {
        warnings.push(`Extracted student name "${input.extractedData.studentName}" does not closely match profile "${input.studentProfile.name}".`);
      }
    }
  }

  // Valid uploads require staff manual verification, so default status is NEEDS_REVIEW
  if (errors.length === 0) {
    finalStatus = 'NEEDS_REVIEW';
  }

  return {
    valid: errors.length === 0,
    status: finalStatus,
    errors,
    warnings,
  };
}
