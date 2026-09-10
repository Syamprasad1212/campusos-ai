import { createWorkflowRequest, executeWorkflowAction } from '../lib/workflows/service';
import { processAndStoreDocument, verifyDocumentByStaff, getAuthorizedDocumentUrl } from '../lib/documents/service';
import { validateDocumentSubmission } from '../lib/documents/validation';
import { canAccessRequest } from '../lib/permissions';
import { UserSession } from '../types';
import { db } from '../lib/db';

async function runDocumentWorkflowE2eTests() {
  console.log('🧪 Starting CampusOS AI Stage 6 Document Intelligence & Security Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Fetch seed users & department
    const studentAlex = await db.user.findUnique({ where: { id: 'usr-student-alex' } });
    const studentSarah = await db.user.findUnique({ where: { id: 'usr-student-sarah' } });
    const staffMark = await db.user.findUnique({ where: { id: 'usr-staff-mark' } });
    const univAdmin = await db.user.findUnique({ where: { id: 'usr-admin-univ-super' } });

    if (!studentAlex || !studentSarah || !staffMark || !univAdmin) {
      throw new Error('Seed users missing. Run seed script first.');
    }

    const regDept = await db.department.findUnique({ where: { code: 'REGISTRAR' } });
    if (!regDept) throw new Error('Registrar department missing.');

    const alexSession: UserSession = {
      id: studentAlex.id,
      email: studentAlex.email,
      name: studentAlex.name,
      role: 'STUDENT',
    };

    const sarahSession: UserSession = {
      id: studentSarah.id,
      email: studentSarah.email,
      name: studentSarah.name,
      role: 'STUDENT',
    };

    const markSession: UserSession = {
      id: staffMark.id,
      email: staffMark.email,
      name: staffMark.name,
      role: 'STAFF',
      departmentId: staffMark.departmentId || regDept.id,
      departmentCode: 'REGISTRAR',
    };

    // 2. File Validation Security Tests
    const exeValidation = validateDocumentSubmission({
      fileName: 'malicious_script.exe',
      fileType: 'application/x-msdownload',
      fileSize: 1024,
    });
    assert(exeValidation.valid === false && exeValidation.status === 'REJECTED', 'Validation rejects executable file (.exe)');

    const sizeValidation = validateDocumentSubmission({
      fileName: 'huge_scanned_transcript.pdf',
      fileType: 'application/pdf',
      fileSize: 15 * 1024 * 1024, // 15 MB
    });
    assert(sizeValidation.valid === false && sizeValidation.status === 'REJECTED', 'Validation rejects oversized file (> 10 MB)');

    // 3. Student ID Profile Mismatch Test
    const profileMismatchValidation = validateDocumentSubmission({
      fileName: 'student_id_card.pdf',
      fileType: 'application/pdf',
      fileSize: 500 * 1024,
      aiConfidence: 0.85,
      extractedData: {
        studentId: '999999',
        studentName: 'John Doe Mismatch',
      },
      studentProfile: {
        id: studentAlex.id,
        name: 'Alex Johnson (Student)',
        email: studentAlex.email,
      },
    });
    assert(
      profileMismatchValidation.status === 'NEEDS_REVIEW' && profileMismatchValidation.warnings.length > 0,
      'Extracted student ID/name profile mismatch triggers NEEDS_REVIEW status'
    );

    // 4. Create Certificate Request (Step 1 requires documents)
    const certRequest = await createWorkflowRequest({
      requesterId: studentAlex.id,
      workflowKey: 'CERTIFICATE_REQUEST',
      title: 'Stage 6 Document Gating Test Request',
      summary: 'Testing mandatory document gating before step approval',
      data: {
        certificateType: 'Bona Fide',
        purpose: 'Passport Verification',
        deliveryPreference: 'Speed Post',
      },
    });

    // 5. WORKFLOW STEP GATING TEST 1: Step completion blocked when required document is missing
    let missingDocStepError = false;
    try {
      await executeWorkflowAction({
        requestId: certRequest.id,
        actorId: staffMark.id,
        action: 'APPROVE',
      });
    } catch (e: any) {
      missingDocStepError = e.message.includes('[VALIDATION_FAILED]') && e.message.includes('Required document is missing');
    }
    assert(missingDocStepError, 'Workflow Step 1 completion BLOCKED when required document is missing');

    // 6. Process & Upload Document for Request
    const sampleBuffer = Buffer.from('PDF-1.4 %STUDENT_ID_CARD% Name: Alex Johnson StudentID: usr-student-alex Official Registrar Seal');
    const uploadResult = await processAndStoreDocument({
      requestId: certRequest.id,
      uploaderId: studentAlex.id,
      fileName: 'alex_student_id.pdf',
      mimeType: 'application/pdf',
      fileBuffer: sampleBuffer,
      documentType: 'STUDENT_ID',
    });

    assert(uploadResult.document.id !== undefined, 'Document uploaded and DB record created');
    assert((uploadResult.document.storageReference || '').includes('requests/'), 'Storage path uses secure non-PII structure');

    // 7. WORKFLOW STEP GATING TEST 2: Step completion blocked when document is PENDING / NEEDS_REVIEW
    let unverifiedDocStepError = false;
    try {
      await executeWorkflowAction({
        requestId: certRequest.id,
        actorId: staffMark.id,
        action: 'APPROVE',
      });
    } catch (e: any) {
      unverifiedDocStepError = e.message.includes('[VALIDATION_FAILED]') && e.message.includes('not verified');
    }
    assert(unverifiedDocStepError, 'Workflow Step 1 completion BLOCKED when required document is NEEDS_REVIEW / PENDING');

    // 8. DOCUMENT SECURITY BOUNDARY TESTS
    let studentBUrlError = false;
    try {
      await getAuthorizedDocumentUrl(uploadResult.document.id, sarahSession);
    } catch (e: any) {
      studentBUrlError = e.message.includes('[FORBIDDEN]');
    }
    assert(studentBUrlError, 'Student B CANNOT obtain signed URL for Student A document (Security Boundary)');

    const financeDept = await db.department.findUnique({ where: { code: 'FINANCE' } });
    const otherDeptStaffSession: UserSession = {
      id: 'usr-staff-finance-test',
      email: 'finance.staff@campus.edu',
      name: 'Finance Staff',
      role: 'STAFF',
      departmentId: financeDept?.id || 'dept-finance-id',
      departmentCode: 'FINANCE',
    };

    let nonAssignedStaffUrlError = false;
    try {
      await getAuthorizedDocumentUrl(uploadResult.document.id, otherDeptStaffSession);
    } catch (e: any) {
      nonAssignedStaffUrlError = e.message.includes('[FORBIDDEN]');
    }
    assert(nonAssignedStaffUrlError, 'Staff from non-assigned department CANNOT obtain signed document URL');

    let studentVerifyError = false;
    try {
      await verifyDocumentByStaff({
        documentId: uploadResult.document.id,
        actorId: studentAlex.id,
        status: 'VERIFIED',
      });
    } catch (e: any) {
      studentVerifyError = e.message.includes('[FORBIDDEN]');
    }
    assert(studentVerifyError, 'Student CANNOT perform staff document verification');

    // 9. STAFF MANUAL DOCUMENT VERIFICATION
    const verifiedDoc = await verifyDocumentByStaff({
      documentId: uploadResult.document.id,
      actorId: staffMark.id,
      status: 'VERIFIED',
    });
    assert(verifiedDoc.verificationStatus === 'VERIFIED', 'Staff member verified document status');

    // 10. WORKFLOW STEP GATING TEST 3: Step completion PERMITTED when document is VERIFIED
    await executeWorkflowAction({
      requestId: certRequest.id,
      actorId: staffMark.id,
      action: 'APPROVE',
    });

    const step2State = await db.request.findUnique({ where: { id: certRequest.id } });
    assert(step2State?.currentStep === 2, 'Step 1 completed and advanced to Step 2 after document verification');

    // 11. STAFF DOCUMENT REJECTION & MANDATORY REASON TEST
    const docToReject = await processAndStoreDocument({
      requestId: certRequest.id,
      uploaderId: studentAlex.id,
      fileName: 'blurry_scan.png',
      mimeType: 'image/png',
      fileBuffer: Buffer.from('FAKE_PNG_DATA'),
      documentType: 'SUPPORTING_DOCUMENT',
    });

    let rejectWithoutReasonError = false;
    try {
      await verifyDocumentByStaff({
        documentId: docToReject.document.id,
        actorId: staffMark.id,
        status: 'REJECTED',
        reason: '',
      });
    } catch (e: any) {
      rejectWithoutReasonError = e.message.includes('[VALIDATION_FAILED]');
    }
    assert(rejectWithoutReasonError, 'Staff document rejection requires non-empty reason');

    const rejectedDoc = await verifyDocumentByStaff({
      documentId: docToReject.document.id,
      actorId: staffMark.id,
      status: 'REJECTED',
      reason: 'Scan is blurry and illegible.',
    });
    assert(rejectedDoc.verificationStatus === 'REJECTED' && rejectedDoc.notes === 'Scan is blurry and illegible.', 'Document successfully rejected with reason stored');

    // 12. AUDIT TRAIL VERIFICATION
    const auditLogs = await db.auditLog.findMany({
      where: { requestId: certRequest.id },
    });
    const hasUploadAudit = auditLogs.some((l) => l.action === 'DOCUMENT_UPLOADED');
    const hasVerifyAudit = auditLogs.some((l) => l.action === 'DOCUMENT_VERIFIED');
    const hasRejectAudit = auditLogs.some((l) => l.action === 'DOCUMENT_REJECTED');
    assert(hasUploadAudit && hasVerifyAudit && hasRejectAudit, 'Full document lifecycle recorded in AuditLog (DOCUMENT_UPLOADED, DOCUMENT_VERIFIED, DOCUMENT_REJECTED)');

    console.log(`\n📊 Stage 6 Document Intelligence & Security Test Summary: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('❌ Stage 6 Test Execution Error:', err);
    process.exit(1);
  }
}

runDocumentWorkflowE2eTests();
