import { getCurrentAppUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, ArrowRight, Clock } from 'lucide-react';
import { WORKFLOW_DEFINITIONS } from '@/lib/workflows/definitions';

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
          <span className="text-xs text-slate-500">2 active requests</span>
        </div>

        <div className="divide-y divide-slate-100">
          <div className="py-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">Academic Transcript Request</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                  In Review (Step 1/2)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Ref: REQ-DEMO-001 • Department: Registrar</p>
            </div>
            <button className="text-xs font-semibold text-sky-600 hover:text-sky-800">
              View Details →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
