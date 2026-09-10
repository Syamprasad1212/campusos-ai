import Link from 'next/link';
import HeaderNav from '@/components/ui/navigation';
import {
  GraduationCap,
  UserCheck,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Building2,
  FileText,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { WORKFLOW_DEFINITIONS } from '@/lib/workflows/definitions';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <HeaderNav currentPortal="home" />

      {/* Hero Section */}
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 border border-sky-200 text-sky-800 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Campus Operations Platform
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto">
            Describe what you need.{' '}
            <span className="text-sky-600">CampusOS gets it done.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
            CampusOS automates university workflows from student requests to staff approvals, routing, and completion tracking — eliminating repetitive administrative overhead.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 transition shadow-sm"
            >
              <GraduationCap className="h-5 w-5" />
              <span>Student Portal</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/staff/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-900 transition shadow-sm"
            >
              <UserCheck className="h-5 w-5" />
              <span>Staff Queue Portal</span>
            </Link>

            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition shadow-sm"
            >
              <ShieldCheck className="h-5 w-5 text-slate-500" />
              <span>Admin Management</span>
            </Link>
          </div>
        </section>

        {/* Workflow Categories Overview */}
        <section className="bg-white border-y border-slate-200 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-slate-900">Supported Campus Workflows</h2>
              <p className="text-slate-600 mt-2">Configured workflow patterns ready for automated routing & multi-level signoffs</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {WORKFLOW_DEFINITIONS.map((wf) => (
                <div
                  key={wf.id}
                  className="p-5 rounded-xl border border-slate-200 bg-slate-50 hover:border-sky-300 hover:shadow-sm transition"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-sky-700 uppercase tracking-wider px-2 py-0.5 bg-sky-100 rounded">
                      {wf.departmentCode}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {wf.pattern.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 text-lg mb-1">{wf.title}</h3>
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">{wf.description}</p>
                  
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {wf.stepSequence.length} Approval Steps
                    </span>
                    <span className="flex items-center gap-1 font-medium text-sky-600">
                      <FileText className="h-3.5 w-3.5" />
                      {wf.requiredFields.length} Form Fields
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-sm py-8 border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">CampusOS AI</span>
            <span>— University Workflow Automation Platform</span>
          </div>
          <div>Stage 1 Foundation Architecture</div>
        </div>
      </footer>
    </div>
  );
}
