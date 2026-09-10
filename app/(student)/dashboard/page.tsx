import { getCurrentAppUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, ArrowRight, Clock, FileText, ChevronRight } from 'lucide-react';
import { WORKFLOW_DEFINITIONS } from '@/lib/workflows/definitions';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function StudentDashboard() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect('/login');
  }

  // Server-side Role Guard: Only STUDENT and FACULTY can access Student Portal
  if (user.role === 'STAFF') {
    redirect('/staff/dashboard');
  }
  if (user.role === 'DEPARTMENT_ADMIN' || user.role === 'UNIVERSITY_ADMIN') {
    redirect('/admin/dashboard');
  }

  const activeRequests = await db.request.findMany({
    where: {
      studentId: user.id,
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
    },
    include: {
      workflow: true,
      department: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return (
    <div className="space-y-8">
      {/* Header with authenticated identity */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student Portal</h1>
          <p className="text-slate-600 text-sm">Welcome back, <span className="font-semibold text-slate-900">{user.name}</span> ({user.email})</p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-800">
          <span>Role: {user.role}</span>
          {user.departmentCode && <span>• Dept: {user.departmentCode}</span>}
        </div>
      </div>

      {/* AI Prompt Box Hero */}
      <div className="rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sky-700 font-semibold text-sm">
            <Sparkles className="h-4 w-4" />
            <span>CampusOS AI Assistant</span>
          </div>

          <Link
            href="/dashboard/request"
            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900"
          >
            <span>Open AI Studio</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-4">
          What do you need help with?
        </h2>

        <Link
          href="/dashboard/request"
          className="block w-full rounded-xl border border-slate-300 bg-white p-4 text-slate-400 shadow-sm hover:border-sky-400 hover:shadow transition text-sm relative"
        >
          <span>e.g. I need a bona fide certificate for my passport application, or my hostel AC isn't working...</span>
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow">
            <span>Start Request</span>
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        {/* Quick category triggers */}
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Quick options:</span>
          {WORKFLOW_DEFINITIONS.slice(0, 5).map((wf) => (
            <Link
              key={wf.id}
              href="/dashboard/request"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 hover:border-sky-300 hover:bg-sky-50 transition"
            >
              {wf.title}
            </Link>
          ))}
        </div>
      </div>

      {/* Active Requests Shell */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-500" />
            <span>Active Requests</span>
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{activeRequests.length} active request{activeRequests.length === 1 ? '' : 's'}</span>
            <Link
              href="/dashboard/requests"
              className="text-xs font-semibold text-sky-600 hover:text-sky-800"
            >
              View All →
            </Link>
          </div>
        </div>

        {activeRequests.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No active requests currently in progress</p>
            <p className="text-slate-400 mt-0.5">Use the AI Assistant above to start a new campus request.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeRequests.map((req) => (
              <div key={req.id} className="py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{req.title}</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      req.status === 'INFORMATION_REQUIRED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      req.status === 'REJECTED' ? 'bg-red-50 text-red-700 border border-red-200' :
                      'bg-sky-50 text-sky-700 border border-sky-200'
                    }`}>
                      {req.status.replace(/_/g, ' ')} (Step {req.currentStep})
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Ref: {req.referenceNo} • Department: {req.department.name}</p>
                </div>
                <Link
                  href={`/dashboard/requests/${req.id}`}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
                >
                  <span>Track Status</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
