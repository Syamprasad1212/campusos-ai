'use me';
'use client';

import { useState, useEffect } from 'react';

interface ApprovalAdvisoryPanelProps {
  requestId: string;
  isApprover: boolean;
  onActionComplete?: () => void;
}

export default function ApprovalAdvisoryPanel({
  requestId,
  isApprover,
  onActionComplete,
}: ApprovalAdvisoryPanelProps) {
  const [advisory, setAdvisory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchAdvisory();
  }, [requestId]);

  async function fetchAdvisory() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/requests/${requestId}/approval-summary`);
      const json = await res.json();
      if (json.success) {
        setAdvisory(json.data);
      } else {
        setError(json.error || 'Failed to load approval advisory');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching advisory');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprovalAction(action: 'APPROVE' | 'REJECT') {
    if (action === 'REJECT' && !reason.trim()) {
      setError('Please provide a reason for rejecting the request.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch(`/api/requests/${requestId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason.trim() }),
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMsg(`Request successfully ${action === 'APPROVE' ? 'approved' : 'rejected'}.`);
        setReason('');
        if (onActionComplete) onActionComplete();
      } else {
        setError(json.error || `Failed to ${action.toLowerCase()} request.`);
      }
    } catch (err: any) {
      setError(err.message || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse">
        <div className="h-5 bg-slate-800 rounded w-1/3 mb-3"></div>
        <div className="h-4 bg-slate-800 rounded w-2/3"></div>
      </div>
    );
  }

  if (!advisory) return null;

  const riskColors = {
    LOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    HIGH: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      {/* Header & Advisory Disclaimer */}
      <div className="flex items-start justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-100">AI Approval Advisory</h3>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${riskColors[advisory.riskAssessment as keyof typeof riskColors] || ''}`}>
              {advisory.riskAssessment} RISK
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{advisory.summary}</p>
        </div>
      </div>

      {/* Advisory Banner Notice */}
      <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-lg p-3 text-xs text-indigo-300 flex items-center gap-2">
        <span className="text-base">🤖</span>
        <span>
          <strong>AI Advisory Analysis:</strong> Recommendations are calculated from verified records. Final approval authority rests strictly with human approvers.
        </span>
      </div>

      {/* Policy Check Details & Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
          <span className="font-medium text-slate-300 block mb-2">📋 Configured Policy Checks:</span>
          <ul className="space-y-1.5 text-slate-400">
            {advisory.policyCheck.details.map((item: string, idx: number) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-emerald-400">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
          <span className="font-medium text-slate-300 block mb-2">💡 Key Observations:</span>
          <ul className="space-y-1.5 text-slate-400">
            {advisory.keyInsights.map((insight: string, idx: number) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-indigo-400">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Feedback & Errors */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400">
          {successMsg}
        </div>
      )}

      {/* Human Approval Action Controls */}
      {isApprover && (
        <div className="border-t border-slate-800 pt-4 space-y-3">
          <label className="block text-xs font-medium text-slate-300">
            Human Decision Notes / Reason (Required for rejection):
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Add official comments or rejection reason..."
            className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            rows={2}
          />
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => handleApprovalAction('REJECT')}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition disabled:opacity-50"
            >
              Reject Request
            </button>
            <button
              onClick={() => handleApprovalAction('APPROVE')}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition disabled:opacity-50"
            >
              Approve Request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
