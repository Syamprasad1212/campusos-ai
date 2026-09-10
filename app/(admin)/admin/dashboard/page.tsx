import { getCurrentAppUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { ShieldCheck, Building2, Sliders, Activity, Database } from 'lucide-react';
import { WORKFLOW_DEFINITIONS } from '@/lib/workflows/definitions';

export default async function AdminDashboard() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect('/login');
  }

  // Server-side RBAC Guard: Only DEPARTMENT_ADMIN or UNIVERSITY_ADMIN can access admin dashboard
  if (user.role !== 'DEPARTMENT_ADMIN' && user.role !== 'UNIVERSITY_ADMIN') {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">University Admin Portal</h1>
          <p className="text-slate-600 text-sm">System configuration, department management, and workflow oversight.</p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
          <ShieldCheck className="h-4 w-4 text-sky-400" />
          <span>{user.name} ({user.role})</span>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase">
            <Building2 className="h-4 w-4" />
            <span>Departments</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">12</div>
          <div className="mt-1 text-xs text-slate-500">Active university units</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase">
            <Sliders className="h-4 w-4" />
            <span>Configured Workflows</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{WORKFLOW_DEFINITIONS.length}</div>
          <div className="mt-1 text-xs text-emerald-600 font-medium">Data-driven templates</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase">
            <Activity className="h-4 w-4" />
            <span>Total Requests</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">1,480</div>
          <div className="mt-1 text-xs text-slate-500">Processed this semester</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase">
            <Database className="h-4 w-4 text-slate-500" />
            <span>System Health</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-600">100%</div>
          <div className="mt-1 text-xs text-emerald-600 font-medium">Operational</div>
        </div>
      </div>

      {/* Workflow Definitions Registry */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 text-lg mb-4">Workflow Engine Registry (Config-Driven)</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 uppercase">
              <tr>
                <th className="py-3 px-4">Workflow ID</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Dept</th>
                <th className="py-3 px-4">Pattern</th>
                <th className="py-3 px-4">Steps</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {WORKFLOW_DEFINITIONS.map((wf) => (
                <tr key={wf.id}>
                  <td className="py-3 px-4 font-mono text-xs font-bold text-slate-900">{wf.id}</td>
                  <td className="py-3 px-4 font-medium text-slate-900">{wf.title}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-xs">
                      {wf.departmentCode}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-500">{wf.pattern}</td>
                  <td className="py-3 px-4 text-xs">{wf.stepSequence.length} Steps</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
