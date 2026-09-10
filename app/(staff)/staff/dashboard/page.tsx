'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  UserCheck, 
  Filter, 
  Clock, 
  CheckCircle2, 
  HelpCircle, 
  XCircle, 
  ChevronRight, 
  RefreshCw,
  FileText,
  AlertCircle
} from 'lucide-react';

interface RequestItem {
  id: string;
  referenceNo: string;
  title: string;
  status: string;
  currentStep: number;
  createdAt: string;
  student: {
    name: string;
    email: string;
  };
  department: {
    name: string;
    code: string;
  };
  workflow: {
    name: string;
  };
}

export default function StaffDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/requests?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store',
        },
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load requests');
      }

      setRequests(json.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch staff request queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'PENDING') return r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW' || r.status === 'ROUTED' || r.status === 'APPROVAL_PENDING';
    if (filterStatus === 'INFO') return r.status === 'INFORMATION_REQUIRED';
    if (filterStatus === 'COMPLETED') return r.status === 'COMPLETED';
    if (filterStatus === 'REJECTED') return r.status === 'REJECTED';
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW' || r.status === 'APPROVAL_PENDING').length;
  const infoCount = requests.filter((r) => r.status === 'INFORMATION_REQUIRED').length;
  const completedCount = requests.filter((r) => r.status === 'COMPLETED').length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header & Department Scope Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff Operations Work Queue</h1>
          <p className="text-slate-600 text-sm">Review, verify, request details, and approve departmental student workflows.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchRequests}
            className="inline-flex items-center gap-1.5 text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-slate-500">Pending Review</div>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{pendingCount}</div>
          <div className="mt-1 text-xs text-amber-600 font-medium">Requires staff evaluation</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-slate-500">Info Requested</div>
            <HelpCircle className="h-4 w-4 text-sky-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{infoCount}</div>
          <div className="mt-1 text-xs text-slate-500">Awaiting student response</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-slate-500">Completed</div>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{completedCount}</div>
          <div className="mt-1 text-xs text-emerald-600 font-medium">Fully processed & signed off</div>
        </div>
      </div>

      {/* Queue Filter Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs overflow-x-auto">
        <span className="font-semibold text-slate-500 mr-2 flex items-center gap-1">
          <Filter className="h-3.5 w-3.5" /> Filter:
        </span>
        
        {[
          { key: 'ALL', label: 'All Requests' },
          { key: 'PENDING', label: `Pending Review (${pendingCount})` },
          { key: 'INFO', label: `Info Needed (${infoCount})` },
          { key: 'COMPLETED', label: `Completed (${completedCount})` },
          { key: 'REJECTED', label: 'Rejected' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              filterStatus === tab.key
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Task Queue Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-sky-600 border-t-transparent"></div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No requests found in this view</p>
            <p className="text-slate-400 mt-0.5">Change filter criteria or wait for new student submissions.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-700 uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Ref No</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Workflow Type</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Current Step</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{req.referenceNo}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block">{req.student.name}</span>
                      <span className="text-slate-400 text-[11px]">{req.student.email}</span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">{req.workflow.name}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {req.department.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">Step {req.currentStep}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        req.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        req.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        req.status === 'INFORMATION_REQUIRED' ? 'bg-amber-100 text-amber-800' :
                        'bg-sky-100 text-sky-800'
                      }`}>
                        {req.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/staff/requests/${req.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-sky-600 hover:text-sky-800 hover:underline"
                      >
                        <span>Review</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
