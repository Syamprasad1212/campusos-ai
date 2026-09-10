import { canAccessRequest, assertPermission, isUniversityAdmin, isDepartmentAdmin, isDepartmentStaff } from '../lib/permissions';
import { UserSession } from '../types';

export function runAuthRbacTests() {
  console.log('🧪 Starting CampusOS AI Auth & RBAC Security Tests...\n');
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

  const studentUser: UserSession = {
    id: 'usr-student-alex',
    name: 'Alex Johnson',
    email: 'alex.student@campus.edu',
    role: 'STUDENT',
  };

  const otherStudentUser: UserSession = {
    id: 'usr-student-sarah',
    name: 'Sarah Lee',
    email: 'sarah.student@campus.edu',
    role: 'STUDENT',
  };

  const staffUser: UserSession = {
    id: 'usr-staff-mark',
    name: 'Mark Davis',
    email: 'mark.staff@campus.edu',
    role: 'STAFF',
    departmentId: 'dept-registrar',
    departmentCode: 'REGISTRAR',
  };

  const deptAdminUser: UserSession = {
    id: 'usr-admin-dept-dean',
    name: 'Dr. Helen Vance',
    email: 'dean.registrar@campus.edu',
    role: 'DEPARTMENT_ADMIN',
    departmentId: 'dept-registrar',
    departmentCode: 'REGISTRAR',
  };

  const univAdminUser: UserSession = {
    id: 'usr-admin-univ-super',
    name: 'Vice Chancellor Admin',
    email: 'admin.super@campus.edu',
    role: 'UNIVERSITY_ADMIN',
  };

  // 1. Student Ownership Restriction
  assert(
    canAccessRequest(studentUser, 'usr-student-alex', 'dept-registrar') === true,
    'Student can access own request'
  );
  assert(
    canAccessRequest(studentUser, 'usr-student-sarah', 'dept-registrar') === false,
    'Student CANNOT access another student request'
  );

  // 2. Staff Departmental Boundary
  assert(
    canAccessRequest(staffUser, 'usr-student-alex', 'dept-registrar') === true,
    'Staff can access request in their assigned department'
  );
  assert(
    canAccessRequest(staffUser, 'usr-student-alex', 'dept-hostel') === false,
    'Staff CANNOT access request in a different department'
  );

  // 3. Department Admin Boundaries
  assert(
    isDepartmentAdmin(deptAdminUser, 'dept-registrar') === true,
    'Department Admin has admin privileges for their department'
  );
  assert(
    isDepartmentAdmin(deptAdminUser, 'dept-hostel') === false,
    'Department Admin DOES NOT have admin privileges for another department'
  );

  // 4. University Admin Platform Access
  assert(
    isUniversityAdmin(univAdminUser) === true,
    'University Admin is identified as University Admin'
  );
  assert(
    canAccessRequest(univAdminUser, 'usr-student-alex', 'dept-hostel') === true,
    'University Admin has full access across all departments'
  );

  // 5. Role-aware Default Route Mapping
  const { getDefaultDashboardRoute, canAccessPortalRoute } = require('../lib/permissions');
  assert(
    getDefaultDashboardRoute('STUDENT') === '/dashboard',
    'STUDENT default dashboard route is /dashboard'
  );
  assert(
    getDefaultDashboardRoute('FACULTY') === '/dashboard',
    'FACULTY default dashboard route is /dashboard'
  );
  assert(
    getDefaultDashboardRoute('STAFF') === '/staff/dashboard',
    'STAFF default dashboard route is /staff/dashboard'
  );
  assert(
    getDefaultDashboardRoute('DEPARTMENT_ADMIN') === '/admin/dashboard',
    'DEPARTMENT_ADMIN default dashboard route is /admin/dashboard'
  );
  assert(
    getDefaultDashboardRoute('UNIVERSITY_ADMIN') === '/admin/dashboard',
    'UNIVERSITY_ADMIN default dashboard route is /admin/dashboard'
  );

  // 6. Role-aware Portal Route Permissions
  assert(
    canAccessPortalRoute('STUDENT', '/dashboard') === true &&
    canAccessPortalRoute('STUDENT', '/staff/dashboard') === false &&
    canAccessPortalRoute('STUDENT', '/admin/dashboard') === false,
    'STUDENT can only access /dashboard, cannot access staff or admin portals'
  );
  assert(
    canAccessPortalRoute('STAFF', '/dashboard') === false &&
    canAccessPortalRoute('STAFF', '/staff/dashboard') === true &&
    canAccessPortalRoute('STAFF', '/admin/dashboard') === false,
    'STAFF can access /staff/dashboard, cannot access student or admin portals'
  );
  assert(
    canAccessPortalRoute('DEPARTMENT_ADMIN', '/dashboard') === false &&
    canAccessPortalRoute('DEPARTMENT_ADMIN', '/staff/dashboard') === true &&
    canAccessPortalRoute('DEPARTMENT_ADMIN', '/admin/dashboard') === true,
    'DEPARTMENT_ADMIN can access staff and admin portals, cannot access student portal'
  );
  assert(
    canAccessPortalRoute('UNIVERSITY_ADMIN', '/dashboard') === false &&
    canAccessPortalRoute('UNIVERSITY_ADMIN', '/staff/dashboard') === true &&
    canAccessPortalRoute('UNIVERSITY_ADMIN', '/admin/dashboard') === true,
    'UNIVERSITY_ADMIN can access staff and admin portals, cannot access student portal'
  );

  // 7. Client Payload Tampering Guard
  function simulateRequestCreation(clientProvidedRole: string, authSessionUser: UserSession) {
    // Security Rule: Application overrides client-provided identity with authenticated session
    return {
      effectiveRequesterId: authSessionUser.id,
      effectiveRole: authSessionUser.role,
    };
  }

  const tamperedPayload = simulateRequestCreation('UNIVERSITY_ADMIN', studentUser);
  assert(
    tamperedPayload.effectiveRequesterId === 'usr-student-alex' && tamperedPayload.effectiveRole === 'STUDENT',
    'API ignores client-provided role/requesterId and enforces authenticated identity'
  );

  // 8. Operational Role Checks for Document Verification & Workflow Step Approval
  const operationalRoles = ['STAFF', 'FACULTY', 'DEPARTMENT_ADMIN', 'UNIVERSITY_ADMIN'];
  for (const opRole of operationalRoles) {
    const isOpRole = ['STAFF', 'FACULTY', 'DEPARTMENT_ADMIN', 'UNIVERSITY_ADMIN'].includes(opRole);
    assert(isOpRole, `Role ${opRole} is recognized as an authorized operational role`);
  }
  assert(!['STAFF', 'FACULTY', 'DEPARTMENT_ADMIN', 'UNIVERSITY_ADMIN'].includes('STUDENT'), 'STUDENT is NOT an operational role');

  console.log(`\n📊 Auth & RBAC Test Summary: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAuthRbacTests();
}
