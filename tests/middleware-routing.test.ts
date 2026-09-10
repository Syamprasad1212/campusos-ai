import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import { getDefaultDashboardRoute, canAccessPortalRoute } from '../lib/permissions';

export async function runMiddlewareRoutingTests() {
  console.log('🧪 Starting CampusOS AI Middleware & Role Routing Tests...\n');

  // --- 1. Static Audit: Middleware Edge Runtime Compatibility ---
  const middlewarePath = path.join(process.cwd(), 'middleware.ts');
  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');

  // Verify middleware does NOT import Prisma or database client
  assert(!middlewareContent.includes('@prisma/client'), 'Middleware MUST NOT import @prisma/client');
  assert(!middlewareContent.includes('@/lib/db'), 'Middleware MUST NOT import database client');
  assert(!middlewareContent.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Middleware MUST NOT reference service-role key');
  console.log('  ✅ PASS: 1. Middleware is Edge-compatible: zero Prisma/DB imports & zero service-role keys');

  // --- 2. Unauthenticated Protected Route Redirects ---
  const testHost = 'https://campusos-ai-jade.vercel.app';

  function createTestRequest(pathname: string): NextRequest {
    return new NextRequest(new URL(pathname, testHost));
  }

  // A. Unauthenticated /dashboard -> Redirects to /login
  const reqDashboard = createTestRequest('/dashboard');
  const resDashboard = await middleware(reqDashboard);
  assert.strictEqual(resDashboard.status, 307, 'Unauthenticated /dashboard must return 307 redirect');
  const redirectDashboard = resDashboard.headers.get('location');
  assert(redirectDashboard?.includes('/login'), 'Redirect URL must target /login');
  assert(redirectDashboard?.includes('redirectTo=%2Fdashboard') || redirectDashboard?.includes('redirectTo=/dashboard'), 'Redirect URL must preserve target');
  console.log('  ✅ PASS: 2. Unauthenticated /dashboard redirects safely to login');

  // B. Unauthenticated /staff/dashboard -> Redirects to /login
  const reqStaff = createTestRequest('/staff/dashboard');
  const resStaff = await middleware(reqStaff);
  assert.strictEqual(resStaff.status, 307, 'Unauthenticated /staff/dashboard must return 307 redirect');
  const redirectStaff = resStaff.headers.get('location');
  assert(redirectStaff?.includes('/login'), 'Redirect URL must target /login');
  assert(redirectStaff?.includes('staff%2Fdashboard') || redirectStaff?.includes('staff/dashboard'), 'Redirect URL must preserve staff target');
  console.log('  ✅ PASS: 3. Unauthenticated /staff/dashboard redirects safely to login');

  // C. Unauthenticated /admin/dashboard -> Redirects to /login
  const reqAdmin = createTestRequest('/admin/dashboard');
  const resAdmin = await middleware(reqAdmin);
  assert.strictEqual(resAdmin.status, 307, 'Unauthenticated /admin/dashboard must return 307 redirect');
  const redirectAdmin = resAdmin.headers.get('location');
  assert(redirectAdmin?.includes('/login'), 'Redirect URL must target /login');
  assert(redirectAdmin?.includes('admin%2Fdashboard') || redirectAdmin?.includes('admin/dashboard'), 'Redirect URL must preserve admin target');
  console.log('  ✅ PASS: 4. Unauthenticated /admin/dashboard redirects safely to login');

  // D. Unprotected Public Route -> 200 Next
  const reqPublic = createTestRequest('/');
  const resPublic = await middleware(reqPublic);
  assert.strictEqual(resPublic.status, 200, 'Public homepage must pass through with status 200');
  console.log('  ✅ PASS: 5. Public homepage passes through cleanly without redirect');

  // --- 3. Role-Based Destination Routing Verification ---
  assert.strictEqual(getDefaultDashboardRoute('STUDENT'), '/dashboard');
  assert.strictEqual(getDefaultDashboardRoute('FACULTY'), '/dashboard');
  assert.strictEqual(getDefaultDashboardRoute('STAFF'), '/staff/dashboard');
  assert.strictEqual(getDefaultDashboardRoute('DEPARTMENT_ADMIN'), '/admin/dashboard');
  assert.strictEqual(getDefaultDashboardRoute('UNIVERSITY_ADMIN'), '/admin/dashboard');
  console.log('  ✅ PASS: 6. Authoritative role landing destinations verified for all 5 roles');

  // --- 4. Role-Aware Route Permission Boundaries ---
  // Student access restrictions
  assert.strictEqual(canAccessPortalRoute('STUDENT', '/dashboard'), true, 'Student can access /dashboard');
  assert.strictEqual(canAccessPortalRoute('STUDENT', '/staff/dashboard'), false, 'Student CANNOT access /staff');
  assert.strictEqual(canAccessPortalRoute('STUDENT', '/admin/dashboard'), false, 'Student CANNOT access /admin');

  // Staff access restrictions
  assert.strictEqual(canAccessPortalRoute('STAFF', '/staff/dashboard'), true, 'Staff can access /staff');
  assert.strictEqual(canAccessPortalRoute('STAFF', '/admin/dashboard'), false, 'Staff CANNOT access /admin');

  // Department Admin & University Admin access
  assert.strictEqual(canAccessPortalRoute('DEPARTMENT_ADMIN', '/admin/dashboard'), true, 'Department Admin can access /admin');
  assert.strictEqual(canAccessPortalRoute('DEPARTMENT_ADMIN', '/staff/dashboard'), true, 'Department Admin can access /staff');
  assert.strictEqual(canAccessPortalRoute('UNIVERSITY_ADMIN', '/admin/dashboard'), true, 'University Admin can access /admin');
  assert.strictEqual(canAccessPortalRoute('UNIVERSITY_ADMIN', '/staff/dashboard'), true, 'University Admin can access /staff');
  console.log('  ✅ PASS: 7. Authoritative RBAC portal route permissions strictly enforced');

  console.log('\n📊 Middleware & Role Routing Test Summary: 7 Passed, 0 Failed');
}
