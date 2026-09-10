import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { WORKFLOW_DEFINITIONS } from '../lib/workflows/definitions';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting CampusOS AI Seed & Real Supabase Auth Integration...');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let supabaseAdmin: ReturnType<typeof createClient> | null = null;
  if (supabaseServiceKey && supabaseServiceKey !== 'your-supabase-service-role-key') {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    console.log('🔑 Supabase Admin Client initialized for real Auth user provisioning.');
  }

  // 1. Create Campus Departments
  const departmentsData = [
    { code: 'REGISTRAR', name: 'Registrar & Academic Records', description: 'Official academic records, transcripts, and degree certificates.' },
    { code: 'ACADEMIC_AFFAIRS', name: 'Academic Affairs', description: 'Course management, curriculum, attendance, and grading issues.' },
    { code: 'STUDENT_AFFAIRS', name: 'Office of Student Affairs', description: 'Student welfare, leave applications, and event permits.' },
    { code: 'EXAM_CELL', name: 'Examination Cell', description: 'Exam scheduling, grade rosters, and re-evaluation.' },
    { code: 'FINANCE', name: 'Finance & Accounts', description: 'Tuition fees, fee receipts, payment plans, and refunds.' },
    { code: 'FINANCIAL_AID', name: 'Scholarship & Financial Aid', description: 'Merit and need-based financial aid schemes.' },
    { code: 'HOSTEL_ADMIN', name: 'Hostel Administration', description: 'Campus housing allotment and hostel maintenance.' },
    { code: 'TRANSPORT', name: 'Campus Transport Services', description: 'Bus routes, shuttle passes, and transport management.' },
    { code: 'CAREER_CELL', name: 'Career Development & Placement Cell', description: 'Internship NOCs, placement drives, and career guidance.' },
    { code: 'IT_SUPPORT', name: 'IT & Infrastructure Support', description: 'Campus Wi-Fi, LMS access, and hardware support.' },
    { code: 'STUDENT_CLUBS', name: 'Student Clubs & Societies', description: 'Club registration, activities, and budget approvals.' },
    { code: 'CAMPUS_OPS', name: 'Campus Operations & Security', description: 'Facility maintenance, security, passes, and lost & found.' },
  ];

  const departmentMap = new Map<string, string>();

  for (const dept of departmentsData) {
    const record = await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, description: dept.description },
      create: dept,
    });
    departmentMap.set(dept.code, record.id);
  }

  console.log(`✅ Created ${departmentMap.size} university departments.`);

  // 2. Provision Real Supabase Auth Users & Map to Prisma
  const usersData = [
    {
      id: 'usr-student-alex',
      email: 'alex.student@campus.edu',
      name: 'Alex Johnson (Student)',
      role: 'STUDENT' as const,
      departmentCode: 'ACADEMIC_AFFAIRS',
    },
    {
      id: 'usr-student-sarah',
      email: 'sarah.student@campus.edu',
      name: 'Sarah Lee (Student)',
      role: 'STUDENT' as const,
      departmentCode: 'ACADEMIC_AFFAIRS',
    },
    {
      id: 'usr-faculty-smith',
      email: 'prof.smith@campus.edu',
      name: 'Prof. Robert Smith (Faculty)',
      role: 'FACULTY' as const,
      departmentCode: 'ACADEMIC_AFFAIRS',
    },
    {
      id: 'usr-staff-mark',
      email: 'mark.staff@campus.edu',
      name: 'Mark Davis (Staff)',
      role: 'STAFF' as const,
      departmentCode: 'REGISTRAR',
    },
    {
      id: 'usr-admin-dept-dean',
      email: 'dean.registrar@campus.edu',
      name: 'Dr. Helen Vance (Dept Admin)',
      role: 'DEPARTMENT_ADMIN' as const,
      departmentCode: 'REGISTRAR',
    },
    {
      id: 'usr-admin-univ-super',
      email: 'admin.super@campus.edu',
      name: 'Vice Chancellor Admin (Univ Admin)',
      role: 'UNIVERSITY_ADMIN' as const,
      departmentCode: 'ACADEMIC_AFFAIRS',
    },
  ];

  for (const u of usersData) {
    let authUuid: string | undefined;

    if (supabaseAdmin) {
      try {
        const { data: createdAuthUser, error } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: 'Password123!',
          email_confirm: true,
          user_metadata: { name: u.name, role: u.role },
        });

        if (createdAuthUser?.user?.id) {
          authUuid = createdAuthUser.user.id;
        } else if (error) {
          // If user already exists in Supabase Auth, fetch existing Auth user ID
          const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
          const existing = usersList?.users?.find((usr) => usr.email === u.email);
          if (existing) {
            authUuid = existing.id;
          }
        }
      } catch (err) {
        console.warn(`Could not provision Supabase Auth user for ${u.email}:`, err);
      }
    }

    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        departmentId: departmentMap.get(u.departmentCode),
        ...(authUuid ? { supabaseAuthId: authUuid } : {}),
      },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        departmentId: departmentMap.get(u.departmentCode),
        ...(authUuid ? { supabaseAuthId: authUuid } : {}),
      },
    });
  }

  console.log('✅ Preserved demo users and linked Supabase Auth UUIDs where available.');

  // 3. Seed All 13 Workflow Definitions & Steps
  for (const wfDef of WORKFLOW_DEFINITIONS) {
    const deptId = departmentMap.get(wfDef.departmentCode);
    if (!deptId) continue;

    const workflow = await prisma.workflow.upsert({
      where: { key: wfDef.key },
      update: {
        title: wfDef.title,
        name: wfDef.title,
        description: wfDef.description,
        category: wfDef.category,
        pattern: wfDef.pattern,
        departmentId: deptId,
        configJson: JSON.parse(JSON.stringify(wfDef)),
      },
      create: {
        key: wfDef.key,
        name: wfDef.title,
        title: wfDef.title,
        description: wfDef.description,
        category: wfDef.category,
        pattern: wfDef.pattern,
        departmentId: deptId,
        configJson: JSON.parse(JSON.stringify(wfDef)),
      },
    });

    for (const step of wfDef.stepSequence) {
      await prisma.workflowStep.upsert({
        where: {
          workflowId_stepOrder: {
            workflowId: workflow.id,
            stepOrder: step.stepOrder,
          },
        },
        update: {
          name: step.name,
          description: step.description,
          roleRequired: step.roleRequired,
          requiresApproval: step.requiresApproval || false,
          requiresDocuments: step.requiresDocuments || false,
        },
        create: {
          workflowId: workflow.id,
          stepOrder: step.stepOrder,
          name: step.name,
          description: step.description,
          roleRequired: step.roleRequired,
          requiresApproval: step.requiresApproval || false,
          requiresDocuments: step.requiresDocuments || false,
        },
      });
    }
  }

  console.log('✅ Seeded 13 data-driven workflow definitions and step sequences.');
  console.log('🌱 Seed completed successfully (No requests seeded).');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
