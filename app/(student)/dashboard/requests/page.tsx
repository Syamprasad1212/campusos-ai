'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  HelpCircle, 
  XCircle, 
  ChevronRight, 
  Plus, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface RequestItem {
  id: string;
  referenceNo: string;
  title: string;
  status: string;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  department: {
    name: string;
    code: string;
  };
  workflow: {
    name: string;
  };
}

export default function StudentRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [filter, setFilter] = useState<string>('ALL');

  const fetchMyRequests = async () => {
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
        throw new Error(json.error || 'Failed to fetch requests');
      }

      setRequests(json.data || []);
    } catch (err: any) {
      setError(err.message || 'Error loading requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const filtered = requests.filter((r) => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') return r.status !== 'COMPLETED' && r.status !== 'REJECTED' && r.status !== 'CANCELLED';
    if (filter === 'ACTION') return r.status === 'INFORMATION_REQUIRED';
    if (filter === 'COMPLETED') return r.status === 'COMPLETED';
    return true;
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Campus Requests</h1>
          <p className="text-slate-600 text-sm">Track your submitted applications, certificates, and campus issues in real time.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchMyRequests}
            className="inline-flex items-center gap-1.5 text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <Link
            href="/dashboard/request"
            className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition"
          >
            <Plus className="h-4 w-4" />
            New AI Request
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs overflow-x-auto">
        {[
          { key: 'ALL', label: 'All Applications' },
          { key: 'ACTIVE', label: 'Active In-Progress' },
          { key: 'ACTION', label: 'Action Required' },
          { key: 'COMPLETED', label: 'Completed' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              filter === tab.key
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

      {/* Requests Content Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 shadow-sm">
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-sm">No campus requests found</h3>
          <p className="text-slate-500 mt-1 max-w-sm mx-auto">
            You haven't submitted any campus applications matching this filter yet.
          </p>
          <Link
            href="/dashboard/request"
            className="mt-4 inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
          >
            Ask CampusOS AI Now
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-sky-300 hover:shadow transition flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-500">{req.referenceNo}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                    {req.department.name}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-base">{req.title}</h3>
                <p className="text-xs text-slate-500">Workflow: {req.workflow.name}</p>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-0 border-slate-100">
                <div className="text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    req.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                    req.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    req.status === 'INFORMATION_REQUIRED' ? 'bg-amber-100 text-amber-800' :
                    'bg-sky-100 text-sky-800'
                  }`}>
                    {req.status.replace(/_/g, ' ')}
                  </span>
                  <div className="text-[11px] text-slate-400 mt-1">Step {req.currentStep}</div>
                </div>

                <Link
                  href={`/dashboard/requests/${req.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 px-3.5 py-2 rounded-lg transition"
                >
                  <span>Track Status</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
