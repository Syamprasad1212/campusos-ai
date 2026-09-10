import {
  getWorkflowByKey,
  listActiveWorkflows,
} from '../lib/workflows/definitions';
import {
  validateWorkflowData,
  canTransitionStatus,
  ALLOWED_TRANSITIONS,
} from '../lib/workflows/service';
import { canAccessRequest, assertPermission } from '../lib/permissions';
import { UserSession } from '../types';

function runTests() {
  console.log('🧪 Starting CampusOS AI Workflow Engine Unit & Security Tests...\n');
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

  // 1. Workflow Definitions Count
  const workflows = listActiveWorkflows();
  assert(workflows.length === 13, 'List all 13 active workflow definitions');

  // 2. Lookup Workflow by Key
  const certWf = getWorkflowByKey('CERTIFICATE_REQUEST');
  assert(
    certWf !== undefined && (certWf.title.includes('Certificate') || certWf.description.includes('transcript')),
    'Lookup CERTIFICATE_REQUEST by key'
  );

  // 3. Valid Data Payload Validation
  if (certWf) {
    const validData = {
      certificateType: 'Transcript',
      purpose: 'Applying for Masters program abroad',
      deliveryPreference: 'Digital PDF',
    };
    const result = validateWorkflowData(certWf, validData);
    assert(result.valid === true && result.errors.length === 0, 'Validate complete valid payload');
  }

  // 4. Missing Required Field Rejection
  if (certWf) {
    const missingData = {
      certificateType: 'Transcript',
      // missing 'purpose' and 'deliveryPreference'
    };
    const result = validateWorkflowData(certWf, missingData);
    assert(
      result.valid === false && result.errors.some((e) => e.field === 'purpose'),
      'Reject payload missing required fields'
    );
  }

  // 5. Invalid Select Option Rejection
  if (certWf) {
    const invalidOptionData = {
      certificateType: 'NonExistentCertificateType',
      purpose: 'Testing invalid select option',
      deliveryPreference: 'Digital PDF',
    };
    const result = validateWorkflowData(certWf, invalidOptionData);
    assert(
      result.valid === false && result.errors.some((e) => e.field === 'certificateType'),
      'Reject payload with invalid select option'
    );
  }

  // 6. State Machine Allowed Transitions
  assert(canTransitionStatus('SUBMITTED', 'VALIDATING') === true, 'Allow valid state transition SUBMITTED -> VALIDATING');
  assert(canTransitionStatus('UNDER_REVIEW', 'APPROVED') === true, 'Allow valid state transition UNDER_REVIEW -> APPROVED');

  // 7. State Machine Invalid Transitions
  assert(canTransitionStatus('SUBMITTED', 'COMPLETED') === false, 'Reject invalid state transition SUBMITTED -> COMPLETED');
  assert(canTransitionStatus('COMPLETED', 'UNDER_REVIEW') === false, 'Reject transition out of terminal state COMPLETED');

  // 8. Student Ownership Restriction (RBAC)
  const studentSession: UserSession = {
    id: 'usr-student-alex',
    name: 'Alex Johnson',
    email: 'alex@campus.edu',
    role: 'STUDENT',
  };

  const isOwnerAccess = canAccessRequest(studentSession, 'usr-student-alex', 'REGISTRAR');
  const isOtherStudentAccess = canAccessRequest(studentSession, 'usr-student-other', 'REGISTRAR');
  assert(isOwnerAccess === true, 'Student can access own request');
  assert(isOtherStudentAccess === false, 'Student CANNOT access another student request');

  // 9. Staff Department Scope Restriction (RBAC)
  const staffSession: UserSession = {
    id: 'usr-staff-mark',
    name: 'Mark Staff',
    email: 'mark@campus.edu',
    role: 'STAFF',
    departmentId: 'dept-registrar',
  };

  const isStaffSameDept = canAccessRequest(staffSession, 'usr-student-alex', 'dept-registrar');
  const isStaffOtherDept = canAccessRequest(staffSession, 'usr-student-alex', 'dept-hostels');
  assert(isStaffSameDept === true, 'Staff can access requests in their department');
  assert(isStaffOtherDept === false, 'Staff CANNOT access requests in other departments');

  // 10. Assert Permission Exception Helper
  let threwException = false;
  try {
    assertPermission(false, 'Test unauthorized access');
  } catch (e: any) {
    threwException = e.message.includes('[FORBIDDEN]');
  }
  assert(threwException === true, 'assertPermission throws [FORBIDDEN] error on failed condition');

  console.log(`\n📊 Test Summary: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
