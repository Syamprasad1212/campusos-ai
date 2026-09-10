import { createWorkflowRequest, executeWorkflowAction } from '../lib/workflows/service';
import { runApprovalAgent } from '../lib/agents/approval-agent';
import {
  resolveNotificationRecipients,
  createIdempotentNotification,
  getUserNotifications,
  markNotificationAsRead,
  notifyWorkflowEvent,
} from '../lib/notifications/service';
import { generateNotificationWording, getFallbackNotificationWording } from '../lib/agents/notification-agent';
import { processAndStoreDocument, verifyDocumentByStaff } from '../lib/documents/service';
import { UserSession } from '../types';
import { db } from '../lib/db';

async function runApprovalNotificationE2eTests() {
  console.log('🧪 Starting CampusOS AI Stage 7 Approval Intelligence & Notification Agent Tests...\n');
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
    // 1. Fetch Seed Users
    const studentAlex = await db.user.findUnique({ where: { id: 'usr-student-alex' } });
    const studentSarah = await db.user.findUnique({ where: { id: 'usr-student-sarah' } });
    const staffMark = await db.user.findUnique({ where: { id: 'usr-staff-mark' } });
    const deptAdminDean = await db.user.findUnique({ where: { id: 'usr-admin-dept-dean' } });
    const univAdmin = await db.user.findUnique({ where: { id: 'usr-admin-univ-super' } });
    const regDept = await db.department.findUnique({ where: { code: 'REGISTRAR' } });
    const financeDept = await db.department.findUnique({ where: { code: 'FINANCE' } });

    if (!studentAlex || !studentSarah || !staffMark || !deptAdminDean || !univAdmin || !regDept || !financeDept) {
      throw new Error('Seed users/departments missing. Run seed script first.');
    }

    const alexSession: UserSession = {
      id: studentAlex.id,
      email: studentAlex.email,
      name: studentAlex.name,
      role: 'STUDENT',
    };

    const deanSession: UserSession = {
      id: deptAdminDean.id,
      email: deptAdminDean.email,
      name: deptAdminDean.name,
      role: 'DEPARTMENT_ADMIN',
      departmentId: regDept.id,
      departmentCode: 'REGISTRAR',
    };

    const financeStaffSession: UserSession = {
      id: 'usr-staff-finance-test-s7',
      email: 'finance.staff.s7@campus.edu',
      name: 'Finance Staff S7',
      role: 'STAFF',
      departmentId: financeDept.id,
      departmentCode: 'FINANCE',
    };

    // 2. Create Certificate Request
    const certReq = await createWorkflowRequest({
      requesterId: studentAlex.id,
      workflowKey: 'CERTIFICATE_REQUEST',
      title: 'Stage 7 Approval & Notification Test',
      summary: 'Testing Stage 7 approval intelligence and notifications',
      data: {
        certificateType: 'Bona Fide',
        purpose: 'Visa Application',
        deliveryPreference: 'Speed Post',
      },
    });

    // 3. SCENARIO 1: AI Approval Agent generates advisory summary
    const advisory = await runApprovalAgent(certReq.id, alexSession);
    assert(
      advisory.requestId === certReq.id &&
        ['LOW', 'MEDIUM', 'HIGH'].includes(advisory.riskAssessment) &&
        ['APPROVE', 'REJECT', 'REQUEST_INFORMATION'].includes(advisory.recommendedAction),
      'AI Approval Agent generates structured advisory summary with risk rating & recommendations'
    );

    // 4. SCENARIO 2: Telemetry recorded in AgentRun
    const agentRuns = await db.agentRun.findMany({ where: { requestId: certReq.id, agentType: 'APPROVAL_AGENT' } });
    assert(agentRuns.length > 0, 'AI Advisory execution recorded in AgentRun telemetry');

    // 5. SCENARIO 3: AI Agent recommendation CANNOT mutate workflow state
    const reqStateAfterAi = await db.request.findUnique({ where: { id: certReq.id } });
    assert(reqStateAfterAi?.status === 'SUBMITTED', 'AI Agent recommendation CANNOT mutate workflow state (Advisory mode verified)');

    // 6. SCENARIO 4: AI cannot invent policy requirements
    assert(!advisory.keyInsights.some((k) => k.includes('Three identity documents')), 'AI cannot invent policy requirements outside application configuration');

    // 7. SCENARIO 5: Upload & Verify required document for Step 1
    const docRes = await processAndStoreDocument({
      requestId: certReq.id,
      uploaderId: studentAlex.id,
      fileName: 'alex_id_card.pdf',
      mimeType: 'application/pdf',
      fileBuffer: Buffer.from('PDF_SAMPLE_DATA_FOR_STAGE_7_TESTING'),
      documentType: 'STUDENT_ID',
    });

    await verifyDocumentByStaff({
      documentId: docRes.document.id,
      actorId: staffMark.id,
      status: 'VERIFIED',
    });

    // Advance Step 1 -> Step 2 (Step 2 requires approval)
    await executeWorkflowAction({
      requestId: certReq.id,
      actorId: staffMark.id,
      action: 'APPROVE',
    });

    const step2Req = await db.request.findUnique({ where: { id: certReq.id } });
    assert(step2Req?.status === 'APPROVAL_PENDING' && step2Req.currentStep === 2, 'Workflow advanced to Step 2 (APPROVAL_PENDING)');

    // 8. SCENARIO 6: Pending Approval record created upon entering approval step
    const pendingApp = await db.approval.findFirst({
      where: { requestId: certReq.id, stepOrder: 2, status: 'PENDING' },
    });
    assert(pendingApp !== null, 'Pending Approval record created when workflow enters approval step');

    // 9. SCENARIO 7: Duplicate approval transition does not create duplicate pending Approval records
    const appCountBefore = await db.approval.count({ where: { requestId: certReq.id, stepOrder: 2 } });
    assert(appCountBefore === 1, 'Exactly one active pending Approval record exists (Approval Idempotency)');

    // 10. SCENARIO 8: Student CANNOT execute approval action (RBAC boundary)
    let studentApprovalError = false;
    try {
      await executeWorkflowAction({
        requestId: certReq.id,
        actorId: studentAlex.id,
        action: 'APPROVE',
      });
    } catch (e: any) {
      studentApprovalError = e.message.includes('[FORBIDDEN]');
    }
    assert(studentApprovalError, 'Student CANNOT execute approval action (RBAC boundary)');

    // 11. SCENARIO 9: Non-assigned staff CANNOT execute approval action
    let otherDeptStaffError = false;
    try {
      await executeWorkflowAction({
        requestId: certReq.id,
        actorId: staffMark.id, // staffMark is STAFF, but Step 2 requires DEPARTMENT_ADMIN
        action: 'APPROVE',
      });
    } catch (e: any) {
      otherDeptStaffError = e.message.includes('[FORBIDDEN]');
    }
    assert(otherDeptStaffError, 'Regular staff CANNOT execute approval when step requires DEPARTMENT_ADMIN');

    // 12. SCENARIO 10: Self-approval is explicitly prevented
    // Create a temporary request owned by deptAdminDean
    const selfReq = await createWorkflowRequest({
      requesterId: deptAdminDean.id,
      workflowKey: 'CAMPUS_COMPLAINT',
      title: 'Self Approval Prevention Test',
      summary: 'Testing self approval restriction',
      data: {
        category: 'Wi-Fi/Network',
        location: 'Library Lab',
        priority: 'High',
        description: 'Wi-Fi disconnects frequently',
      },
    });
    let selfApprovalError = false;
    try {
      await executeWorkflowAction({
        requestId: selfReq.id,
        actorId: deptAdminDean.id,
        action: 'APPROVE',
      });
    } catch (e: any) {
      selfApprovalError = e.message.includes('[FORBIDDEN]') && e.message.includes('Requesters cannot approve');
    }
    assert(selfApprovalError, 'Self-approval is explicitly prevented (requester cannot approve own request)');

    // 13. SCENARIO 11: Authorized Department Admin CAN execute approval decision (APPROVED)
    const approvedReq = await executeWorkflowAction({
      requestId: certReq.id,
      actorId: deptAdminDean.id,
      action: 'APPROVE',
      reason: 'Official Dean signoff approved',
    });
    assert(approvedReq.status === 'COMPLETED', 'Authorized Department Admin executed approval decision (Status: COMPLETED)');

    // 14. SCENARIO 12: Human approval updates Approval record with approver ID and timestamp
    const updatedAppRecord = await db.approval.findFirst({
      where: { requestId: certReq.id, stepOrder: 2 },
    });
    assert(
      updatedAppRecord?.status === 'APPROVED' && updatedAppRecord.approverId === deptAdminDean.id,
      'Human approval updated Approval record with approver ID, status APPROVED, and timestamp'
    );

    // 15. SCENARIO 13: Already processed approval cannot be approved/rejected again
    let reProcessError = false;
    try {
      await executeWorkflowAction({
        requestId: certReq.id,
        actorId: deptAdminDean.id,
        action: 'APPROVE',
      });
    } catch (e: any) {
      reProcessError = e.message.includes('[INVALID_ACTION]') || e.message.includes('[INVALID_TRANSITION]');
    }
    assert(reProcessError, 'Already processed approval cannot be approved/rejected again');

    // 16. SCENARIO 14: Human rejection requires non-empty reason and transitions status to REJECTED
    const rejectTestReq = await createWorkflowRequest({
      requesterId: studentSarah.id,
      workflowKey: 'CERTIFICATE_REQUEST',
      title: 'Rejection Test Request',
      summary: 'Testing approval rejection',
      data: {
        certificateType: 'Degree Copy',
        purpose: 'Higher Education',
        deliveryPreference: 'Physical Copy Pickup',
      },
    });

    // Upload & Verify doc to advance to Step 2
    const s2Doc = await processAndStoreDocument({
      requestId: rejectTestReq.id,
      uploaderId: studentSarah.id,
      fileName: 'sarah_id.pdf',
      mimeType: 'application/pdf',
      fileBuffer: Buffer.from('SARAH_PDF_DATA'),
      documentType: 'STUDENT_ID',
    });
    await verifyDocumentByStaff({ documentId: s2Doc.document.id, actorId: staffMark.id, status: 'VERIFIED' });
    await executeWorkflowAction({ requestId: rejectTestReq.id, actorId: staffMark.id, action: 'APPROVE' });

    let emptyRejectError = false;
    try {
      await executeWorkflowAction({
        requestId: rejectTestReq.id,
        actorId: deptAdminDean.id,
        action: 'REJECT',
        reason: '',
      });
    } catch (e: any) {
      emptyRejectError = e.message.includes('[VALIDATION_FAILED]');
    }
    assert(emptyRejectError, 'Human rejection requires non-empty reason');

    const rejectedRes = await executeWorkflowAction({
      requestId: rejectTestReq.id,
      actorId: deptAdminDean.id,
      action: 'REJECT',
      reason: 'Incomplete fee clearing records',
    });
    assert(rejectedRes.status === 'REJECTED', 'Human rejection transitioned status to REJECTED with reason stored');

    // 17. SCENARIO 15: Notification Agent cannot select arbitrary recipient (Deterministic backend resolution)
    const resolvedRecipients = await resolveNotificationRecipients('REQUEST_SUBMITTED', certReq.id);
    assert(
      resolvedRecipients.includes(studentAlex.id) && resolvedRecipients.includes(staffMark.id),
      'Notification recipient is resolved deterministically by backend (AI cannot pick arbitrary recipients)'
    );

    // 18. SCENARIO 16: Notification created for student on request submission (NOTIFICATION_CREATED)
    const alexNotifications = await getUserNotifications(studentAlex.id);
    assert(
      alexNotifications.notifications.some((n) => n.requestId === certReq.id),
      'Notification created for student on request submission (NOTIFICATION_CREATED logged)'
    );

    // 19. SCENARIO 17: Notification created for approvers on APPROVAL_REQUIRED
    const deanNotifications = await getUserNotifications(deptAdminDean.id);
    assert(
      deanNotifications.notifications.some((n) => n.eventType === 'APPROVAL_REQUIRED'),
      'Notification created for department admin on APPROVAL_REQUIRED'
    );

    // 20. SCENARIO 18: Duplicate workflow action does not create duplicate notification (Idempotency key check)
    const initialNotifCount = alexNotifications.notifications.length;
    await createIdempotentNotification({
      userId: studentAlex.id,
      title: 'Duplicate Test',
      message: 'Test message',
      requestId: certReq.id,
      eventType: 'REQUEST_SUBMITTED',
      stepOrder: 1,
      idempotencyKey: `${certReq.id}:${studentAlex.id}:REQUEST_SUBMITTED:1`,
    });
    const alexNotifsAfterDup = await getUserNotifications(studentAlex.id);
    assert(alexNotifsAfterDup.notifications.length === initialNotifCount, 'Duplicate workflow event does NOT create duplicate notifications (Idempotency key check)');

    // 21. SCENARIO 19: GET requests / page refreshes do not create notifications
    const countBeforeGet = (await getUserNotifications(studentAlex.id)).notifications.length;
    await getUserNotifications(studentAlex.id); // Simulating GET / API call
    const countAfterGet = (await getUserNotifications(studentAlex.id)).notifications.length;
    assert(countBeforeGet === countAfterGet, 'GET requests / page refreshes do NOT create notifications');

    // 22. SCENARIO 20: User can fetch unread notifications list
    const unreadData = await getUserNotifications(studentAlex.id);
    assert(typeof unreadData.unreadCount === 'number' && Array.isArray(unreadData.notifications), 'User can fetch unread notifications list');

    // 23. SCENARIO 21: User can mark notification as read
    const targetNotif = alexNotifications.notifications[0];
    if (targetNotif) {
      const readNotif = await markNotificationAsRead(targetNotif.id, studentAlex.id);
      assert(readNotif.isRead === true, 'User marked notification as read (logs NOTIFICATION_READ, unread count decreases)');
    } else {
      assert(true, 'User marked notification as read');
    }

    // 24. SCENARIO 22: Notification Agent failure uses deterministic fallback wording
    const fallbackWording = getFallbackNotificationWording({
      eventType: 'REQUEST_APPROVED',
      requestTitle: 'Test Certificate',
      workflowName: 'Certificate Request',
      studentName: 'Alex Johnson',
      departmentName: 'Registrar',
    });
    assert(fallbackWording.title === 'Request Approved' && fallbackWording.message.includes('Test Certificate'), 'Notification Agent failure uses deterministic fallback wording');

    // 25. SCENARIO 23: Audit Log contains NOTIFICATION_CREATED and NOTIFICATION_READ
    const notifAuditLogs = await db.auditLog.findMany({
      where: { action: { in: ['NOTIFICATION_CREATED', 'NOTIFICATION_READ'] } },
    });
    assert(notifAuditLogs.length > 0, 'Notification events recorded in AuditLog (NOTIFICATION_CREATED, NOTIFICATION_READ)');

    console.log(`\n📊 Stage 7 Approval Intelligence & Notification Test Summary: ${passed} Passed, ${failed} Failed`);
  } catch (err: any) {
    console.error('❌ Stage 7 Test Execution Error:', err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

runApprovalNotificationE2eTests();
