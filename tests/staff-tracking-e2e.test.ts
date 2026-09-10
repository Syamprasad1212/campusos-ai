import { createWorkflowRequest, executeWorkflowAction, getRequestTimeline } from '../lib/workflows/service';
import { processAndStoreDocument, verifyDocumentByStaff } from '../lib/documents/service';
import { canAccessRequest } from '../lib/permissions';
import { UserSession } from '../types';
import { db } from '../lib/db';

async function runStaffTrackingE2eTests() {
  console.log('🧪 Starting CampusOS AI Stage 5 Staff Operations & End-to-End Tracking Tests...\n');
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
    // Fetch seed users & department ID
    const studentAlex = await db.user.findUnique({ where: { id: 'usr-student-alex' } });
    const studentSarah = await db.user.findUnique({ where: { id: 'usr-student-sarah' } });
    const staffMark = await db.user.findUnique({ where: { id: 'usr-staff-mark' } });
    const deptDean = await db.user.findUnique({ where: { id: 'usr-admin-dept-dean' } });
    const univAdmin = await db.user.findUnique({ where: { id: 'usr-admin-univ-super' } });

    if (!studentAlex || !studentSarah || !staffMark || !deptDean || !univAdmin) {
      throw new Error('Seed users missing. Run seed script before running tests.');
    }

    const regDept = await db.department.findUnique({ where: { code: 'REGISTRAR' } });
    const opsDept = await db.department.findUnique({ where: { code: 'CAMPUS_OPS' } });

    if (!regDept || !opsDept) {
      throw new Error('Seed departments missing.');
    }

    // 1. RBAC Access Boundaries Test
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

    const markStaffSession: UserSession = {
      id: staffMark.id,
      email: staffMark.email,
      name: staffMark.name,
      role: 'STAFF',
      departmentId: staffMark.departmentId || regDept.id,
      departmentCode: 'REGISTRAR',
    };

    assert(
      canAccessRequest(alexSession, 'usr-student-alex', regDept.id) === true,
      'Student can retrieve own requests'
    );
    assert(
      canAccessRequest(alexSession, 'usr-student-sarah', regDept.id) === false,
      'Student CANNOT retrieve another student request'
    );
    assert(
      canAccessRequest(markStaffSession, 'usr-student-sarah', regDept.id) === true,
      'Staff can retrieve authorized department requests'
    );
    assert(
      canAccessRequest(markStaffSession, 'usr-student-sarah', opsDept.id) === false,
      'Staff CANNOT retrieve unauthorized department requests'
    );

    // 2. END-TO-END CERTIFICATE REQUEST WORKFLOW TEST
    console.log('\n  --- Executing Certificate Request End-to-End Workflow ---');
    const certRequest = await createWorkflowRequest({
      requesterId: studentAlex.id,
      workflowKey: 'CERTIFICATE_REQUEST',
      title: 'E2E Bona Fide Certificate Test',
      summary: 'Testing complete multi-step certificate lifecycle',
      data: {
        certificateType: 'Bona Fide',
        purpose: 'Education Loan Application',
        deliveryPreference: 'Speed Post',
      },
    });

    assert(certRequest.status === 'SUBMITTED' && certRequest.currentStep === 1, 'Certificate request initialized in SUBMITTED state at Step 1');

    // 3. Unauthorized Student Approve Attempt
    let studentApproveError = false;
    try {
      await executeWorkflowAction({
        requestId: certRequest.id,
        actorId: studentAlex.id,
        action: 'APPROVE',
      });
    } catch (e: any) {
      studentApproveError = e.message.includes('[FORBIDDEN]');
    }
    assert(studentApproveError, 'Student CANNOT perform staff approve action (RBAC boundary)');

    // 4. Staff Request Information
    await executeWorkflowAction({
      requestId: certRequest.id,
      actorId: staffMark.id,
      action: 'REQUEST_INFORMATION',
      message: 'Please provide exact mailing pincode',
      field: 'deliveryPreference',
    });

    const infoReqState = await db.request.findUnique({
      where: { id: certRequest.id },
      include: { requestData: true },
    });

    assert(infoReqState?.status === 'INFORMATION_REQUIRED', 'Request transitions to INFORMATION_REQUIRED');
    const meta = (infoReqState?.requestData?.metadata as any) || {};
    assert(meta?.informationRequest?.field === 'deliveryPreference', 'Structured information request metadata recorded');

    // 5. Student Provides Information (Data Safety & Merging)
    await executeWorkflowAction({
      requestId: certRequest.id,
      actorId: studentAlex.id,
      action: 'PROVIDE_INFORMATION',
      field: 'deliveryPreference',
      value: 'Speed Post',
    });

    const infoProvidedState = await db.request.findUnique({
      where: { id: certRequest.id },
      include: { requestData: true },
    });

    assert(infoProvidedState?.status === 'UNDER_REVIEW', 'Request transitions back to UNDER_REVIEW after student response');
    const formData = (infoProvidedState?.requestData?.formData as any) || {};
    assert(formData.certificateType === 'Bona Fide' && formData.deliveryPreference === 'Speed Post', 'PROVIDE_INFORMATION merges response and preserves existing fields');

    // Attach & verify required document for Step 1 gating
    const sampleDoc = await processAndStoreDocument({
      requestId: certRequest.id,
      uploaderId: studentAlex.id,
      fileName: 'alex_id.pdf',
      mimeType: 'application/pdf',
      fileBuffer: Buffer.from('PDF sample ID card content for Alex'),
      documentType: 'STUDENT_ID',
    });
    await verifyDocumentByStaff({
      documentId: sampleDoc.document.id,
      actorId: staffMark.id,
      status: 'VERIFIED',
    });

    // 6. Step 1 Completion by Staff
    await executeWorkflowAction({
      requestId: certRequest.id,
      actorId: staffMark.id,
      action: 'APPROVE',
    });

    const step2State = await db.request.findUnique({ where: { id: certRequest.id } });
    assert(step2State?.currentStep === 2 && step2State?.status === 'APPROVAL_PENDING', 'Step 1 completed; advanced to Step 2 (APPROVAL_PENDING)');

    // 7. Step 2 Approval by Department Admin (Dr. Helen Vance)
    await executeWorkflowAction({
      requestId: certRequest.id,
      actorId: deptDean.id,
      action: 'APPROVE',
    });

    const certCompletedState = await db.request.findUnique({ where: { id: certRequest.id } });
    assert(certCompletedState?.status === 'COMPLETED', 'Certificate request fully COMPLETED after Step 2 signoff');

    // 8. Rejection Validation
    const rejectTestReq = await createWorkflowRequest({
      requesterId: studentSarah.id,
      workflowKey: 'CERTIFICATE_REQUEST',
      title: 'Rejection Validation Test',
      summary: 'Testing mandatory rejection reason',
      data: {
        certificateType: 'Degree Copy',
        purpose: 'Duplicate Request',
        deliveryPreference: 'Digital PDF',
      },
    });

    let rejectWithoutReasonError = false;
    try {
      await executeWorkflowAction({
        requestId: rejectTestReq.id,
        actorId: staffMark.id,
        action: 'REJECT',
        reason: '',
      });
    } catch (e: any) {
      rejectWithoutReasonError = e.message.includes('[VALIDATION_FAILED]');
    }
    assert(rejectWithoutReasonError, 'Rejection requires non-empty reason');

    await executeWorkflowAction({
      requestId: rejectTestReq.id,
      actorId: staffMark.id,
      action: 'REJECT',
      reason: 'Incomplete prerequisite records on file',
    });

    const rejectedState = await db.request.findUnique({ where: { id: rejectTestReq.id } });
    assert(rejectedState?.status === 'REJECTED', 'Request state transitioned to REJECTED with valid reason');

    // 9. END-TO-END CAMPUS COMPLAINT WORKFLOW TEST
    console.log('\n  --- Executing Campus Complaint End-to-End Workflow ---');
    const complaintReq = await createWorkflowRequest({
      requesterId: studentAlex.id,
      workflowKey: 'CAMPUS_COMPLAINT',
      title: 'Projector Leaking Water in Room 302',
      summary: 'HVAC maintenance required in main lab block',
      data: {
        category: 'HVAC',
        location: 'Room 302 Main Lab',
        description: 'Projector unit is dripping water onto desk',
        priority: 'High',
      },
    });

    assert(complaintReq.status === 'SUBMITTED' && complaintReq.currentStep === 1, 'Complaint request created at Step 1');

    // Complaint Step 1: Dispatch by Campus Ops Staff
    await executeWorkflowAction({
      requestId: complaintReq.id,
      actorId: univAdmin.id,
      action: 'APPROVE',
    });

    const complaintStep2 = await db.request.findUnique({ where: { id: complaintReq.id } });
    assert(complaintStep2?.currentStep === 2, 'Complaint Step 1 verified and advanced to Step 2');

    // Complaint Step 2: Resolution Verification Signoff & Completion
    await executeWorkflowAction({
      requestId: complaintReq.id,
      actorId: univAdmin.id,
      action: 'APPROVE',
    });

    const complaintCompleted = await db.request.findUnique({ where: { id: complaintReq.id } });
    assert(complaintCompleted?.status === 'COMPLETED', 'Campus Complaint workflow successfully completed end-to-end');

    // 10. Audit Timeline Generation Test
    const timelineEvents = await getRequestTimeline(certRequest.id);
    assert(
      timelineEvents.length > 0 && timelineEvents.some((e) => e.title === 'REQUEST CREATED') && timelineEvents.some((e) => e.title === 'REQUEST COMPLETED'),
      'Timeline reflects persisted backend audit events'
    );

    console.log(`\n📊 Stage 5 Staff Operations & Tracking Test Summary: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('❌ Test Execution Error:', err);
    process.exit(1);
  }
}

runStaffTrackingE2eTests();
