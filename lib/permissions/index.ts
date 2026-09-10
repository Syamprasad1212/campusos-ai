import { UserSession, UserRole } from '@/types';

export function isUniversityAdmin(user: UserSession): boolean {
  return user.role === 'UNIVERSITY_ADMIN';
}

export function isDepartmentAdmin(user: UserSession, departmentId?: string): boolean {
  if (user.role === 'UNIVERSITY_ADMIN') return true;
  if (user.role === 'DEPARTMENT_ADMIN') {
    return !departmentId || user.departmentId === departmentId;
  }
  return false;
}

export function isDepartmentStaff(user: UserSession, departmentId?: string): boolean {
  if (user.role === 'UNIVERSITY_ADMIN') return true;
  if (user.role === 'DEPARTMENT_ADMIN' || user.role === 'STAFF') {
    return !departmentId || user.departmentId === departmentId;
  }
  return false;
}

export function canAccessRequest(
  user: UserSession,
  requestOwnerStudentId: string,
  requestDepartmentId: string
): boolean {
  // 1. University admin has full platform visibility
  if (user.role === 'UNIVERSITY_ADMIN') return true;

  // 2. Student or Faculty can only access their own requests
  if (user.role === 'STUDENT' || user.role === 'FACULTY') {
    return user.id === requestOwnerStudentId;
  }

  // 3. Department staff & department admins can access requests within their department
  if (user.role === 'STAFF' || user.role === 'DEPARTMENT_ADMIN') {
    return !user.departmentId || user.departmentId === requestDepartmentId;
  }

  return false;
}

export function assertPermission(condition: boolean, message: string = 'Unauthorized'): void {
  if (!condition) {
    throw new Error(`[FORBIDDEN] ${message}`);
  }
}

export function getDefaultDashboardRoute(role: UserRole): string {
  switch (role) {
    case 'STAFF':
      return '/staff/dashboard';
    case 'DEPARTMENT_ADMIN':
    case 'UNIVERSITY_ADMIN':
      return '/admin/dashboard';
    case 'STUDENT':
    case 'FACULTY':
    default:
      return '/dashboard';
  }
}

export function canAccessPortalRoute(role: UserRole, pathname: string): boolean {
  if (pathname.startsWith('/admin')) {
    return role === 'DEPARTMENT_ADMIN' || role === 'UNIVERSITY_ADMIN';
  }
  if (pathname.startsWith('/staff')) {
    return role === 'STAFF' || role === 'DEPARTMENT_ADMIN' || role === 'UNIVERSITY_ADMIN';
  }
  if (pathname.startsWith('/dashboard')) {
    return role === 'STUDENT' || role === 'FACULTY';
  }
  return true;
}
