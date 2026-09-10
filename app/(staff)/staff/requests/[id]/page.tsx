'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ApprovalAdvisoryPanel from '@/components/ApprovalAdvisoryPanel';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Clock, 
  User, 
  Building2, 
  FileText, 
  AlertCircle,
  ShieldAlert,
  FileCheck,
  ExternalLink,
  Bot
} from 'lucide-react';

interface RequestDetail {
  id: string;
  referenceNo: string;
  title: string;
  summary: string;
  status: string;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  student: {
    name: string;
    email: string;
    role: string;
  };
  department: {
    name: string;
    code: string;
  };
  workflow: {
    name: string;
    key: string;
  };
  requestData?: {
    formData: Record<string, any>;
    metadata?: Record<string, any>;
  };
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    assignee?: { name: string };
  }>;
}

interface StepDef {
  stepOrder: number;
  name: string;
  description: string;
  roleRequired: string;
  requiresApproval?: boolean;
  requiresDocuments?: boolean;
}

interface DocumentItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  documentType?: string;
  verificationStatus: string;
  extractedData?: Record<string, any>;
  notes?: string;
  createdAt: string;
  signedUrl?: string;
}

interface TimelineItem {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  actorName: string;
  actorRole: string;
  type: string;
  metadata?: Record<string, any>;
}

export default function StaffRequestDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [steps, setSteps] = useState<StepDef[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  // Action Modals State
  const [activeModal, setActiveModal] = useState<'NONE' | 'INFO' | 'REJECT' | 'VERIFY_DOC' | 'REJECT_DOC'>('NONE');
  const [infoField, setInfoField] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  
  // Selected Document for Verification State
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docRejectReason, setDocRejectReason] = useState('');

  const fetchRequestDetails = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await fetch(`/api/requests/${params.id}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to fetch request details');
      }

      setRequest(json.data.request);
      setTimeline(json.data.timeline || []);
      setDocuments(json.data.documents || json.data.request?.documents || []);
      if (json.data.workflowDefinition?.stepSequence) {
        setSteps(json.data.workflowDefinition.stepSequence);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading request');
    } finally {
      if (!silent) setLoading(false);
    }
  };


  useEffect(() => {
    fetchRequestDetails();
  }, [params.id]);

  const handleAction = async (action: string, payload: Record<string, any> = {}) => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch(`/api/requests/${params.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Action "${action}" failed`);
      }

      setSuccessMsg(json.message || 'Action executed successfully');
      setActiveModal('NONE');
      setRejectReason('');
      setInfoMessage('');
      setInfoField('');
      await fetchRequestDetails(true);
    } catch (err: any) {
      setError(err.message || 'Failed to perform action');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDocumentVerification = async (docId: string, status: 'VERIFIED' | 'REJECTED', reason?: string) => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch(`/api/documents/${docId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to verify document');
      }

      setSuccessMsg(`Document status updated to ${status}`);
      setActiveModal('NONE');
      setSelectedDocId(null);
      setDocRejectReason('');
      await fetchRequestDetails(true);
    } catch (err: any) {
      setError(err.message || 'Error updating document verification');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <h3 className="font-bold">Error Loading Request</h3>
        </div>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        <Link href="/staff/dashboard" className="mt-4 inline-flex items-center text-xs font-semibold text-red-700 hover:underline">
          ← Return to Staff Dashboard
        </Link>
      </div>
    );
  }

  if (!request) return null;

  const currentStepDef = steps.find((s) => s.stepOrder === request.currentStep);
  const isTerminal = request.status === 'COMPLETED' || request.status === 'REJECTED' || request.status === 'CANCELLED';

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Top Navigation */}
      <div>
        <Link href="/staff/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Back to Staff Work Queue
        </Link>
      </div>

      {/* Error & Success Feedback Alerts */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold text-red-600 hover:text-red-900">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}

      {/* Main Request Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-slate-500">{request.referenceNo}</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-medium text-slate-500">{request.workflow.name}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{request.title}</h1>
          </div>

          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              request.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
              request.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
              request.status === 'INFORMATION_REQUIRED' ? 'bg-amber-100 text-amber-800' :
              'bg-sky-100 text-sky-800'
            }`}>
              {request.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Student</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">{request.student.name}</span>
            <span className="text-slate-500">{request.student.email}</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Department</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">{request.department.name}</span>
            <span className="text-slate-500">Code: {request.department.code}</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Current Step</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">
              Step {request.currentStep}: {currentStepDef?.name || 'Processing'}
            </span>
            <span className="text-slate-500">Role required: {currentStepDef?.roleRequired || 'STAFF'}</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Submitted</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">
              {new Date(request.createdAt).toLocaleDateString()}
            </span>
            <span className="text-slate-500">{new Date(request.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2 cols wide) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Extracted Request Data Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-sky-600" />
              Request Payload Information
            </h3>

            {request.requestData?.formData && Object.keys(request.requestData.formData).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {Object.entries(request.requestData.formData).map(([key, val]) => (
                  <div key={key} className="rounded-lg bg-slate-50 border border-slate-200/60 p-3">
                    <span className="text-slate-400 font-medium block capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="font-semibold text-slate-900 mt-1 block break-words">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No additional form data provided.</p>
            )}
          </div>

          {/* Document Review & Verification Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-sky-600" />
                Submitted Documents Review ({documents.length})
              </h3>
              {currentStepDef?.requiresDocuments && (
                <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  Step Requires Document Verification
                </span>
              )}
            </div>

            {documents.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No documents submitted for this request.</p>
            ) : (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div key={doc.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{doc.fileName}</span>
                          <span className="text-xs font-mono text-slate-500 font-semibold bg-slate-200/80 px-2 py-0.5 rounded">
                            {doc.documentType || 'GENERAL'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Uploaded: {new Date(doc.createdAt).toLocaleString()} • {(doc.fileSize / 1024).toFixed(1)} KB
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          doc.verificationStatus === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' :
                          doc.verificationStatus === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          doc.verificationStatus === 'NEEDS_REVIEW' ? 'bg-amber-100 text-amber-800' :
                          'bg-sky-100 text-sky-800'
                        }`}>
                          {doc.verificationStatus.replace(/_/g, ' ')}
                        </span>

                        {doc.signedUrl && (
                          <a
                            href={doc.signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-white border border-slate-200 text-sky-600 hover:bg-sky-50 px-3 py-1 rounded-lg text-xs font-semibold shadow-sm"
                          >
                            <span>View File</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* AI Advisory Intelligence & Deterministic Warnings */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                      {doc.extractedData && Object.keys(doc.extractedData).length > 0 && (
                        <div className="rounded-lg bg-white border border-slate-200 p-3">
                          <span className="font-bold text-slate-700 block flex items-center gap-1.5 mb-1.5">
                            <Bot className="h-3.5 w-3.5 text-sky-600" />
                            Extracted AI Fields (Advisory)
                          </span>
                          <div className="space-y-1 text-[11px] text-slate-600">
                            {Object.entries(doc.extractedData).map(([k, v]) => (
                              <div key={k} className="flex justify-between">
                                <span className="capitalize font-medium text-slate-400">{k}:</span>
                                <span className="font-semibold text-slate-900">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {doc.notes && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                          <span className="font-bold text-amber-900 block flex items-center gap-1.5 mb-1">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                            Validation & Verification Notes
                          </span>
                          <p className="text-[11px] text-amber-800">{doc.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Staff Document Manual Actions */}
                    {!isTerminal && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/40">
                        <button
                          disabled={actionLoading}
                          onClick={() => handleDocumentVerification(doc.id, 'VERIFIED')}
                          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm disabled:opacity-50 transition"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mark Verified
                        </button>

                        <button
                          disabled={actionLoading}
                          onClick={() => {
                            setSelectedDocId(doc.id);
                            setActiveModal('REJECT_DOC');
                          }}
                          className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm disabled:opacity-50 transition"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject Document
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Approval Intelligence Advisory Panel */}
          <ApprovalAdvisoryPanel
            requestId={params.id}
            isApprover={!isTerminal}
            onActionComplete={fetchRequestDetails}
          />

          {/* Action Control Panel */}
          {!isTerminal && (() => {
            const hasVerifiedDoc = documents.some((d) => d.verificationStatus === 'VERIFIED');
            const isStepBlockedByDocs = (currentStepDef?.requiresDocuments ?? false) && !hasVerifiedDoc;

            return (
              <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-sky-600" />
                  Staff Operations & Governance Action
                </h3>
                <p className="text-xs text-slate-600 mb-4">
                  Perform authorized action for Step {request.currentStep}: <span className="font-semibold text-slate-900">{currentStepDef?.name}</span>.
                </p>

                {isStepBlockedByDocs && (
                  <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-amber-950">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Missing Requirement for Step {request.currentStep}: Document Verification Required</span>
                    </div>
                    <p className="text-amber-800">
                      {documents.length === 0
                        ? 'No documents have been uploaded by the student yet. Staff cannot proceed until the required document is uploaded and verified.'
                        : 'Submitted document is awaiting manual staff verification. Please review and click "Mark Verified" above before proceeding.'}
                    </p>
                    {documents.length === 0 && (
                      <div className="pt-1">
                        <span className="font-semibold text-slate-700">Recommended Action: </span>
                        <span className="text-amber-900">Click "Request Student Info" below to notify the student to upload their document.</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    disabled={actionLoading || isStepBlockedByDocs}
                    onClick={() => handleAction('APPROVE')}
                    title={isStepBlockedByDocs ? 'Step completion blocked: Required document is missing or not verified.' : undefined}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {currentStepDef?.requiresApproval ? 'Approve & Complete Step' : 'Verify & Proceed'}
                  </button>

                  <button
                    disabled={actionLoading}
                    onClick={() => setActiveModal('INFO')}
                    className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm disabled:opacity-50 transition"
                  >
                    <HelpCircle className="h-4 w-4" />
                    Request Student Info
                  </button>

                  <button
                    disabled={actionLoading}
                    onClick={() => setActiveModal('REJECT')}
                    className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm disabled:opacity-50 transition"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject Request
                  </button>
                </div>
              </div>
            );
          })()}


          {/* Document Rejection Modal */}
          {activeModal === 'REJECT_DOC' && selectedDocId && (
            <div className="rounded-xl border border-red-300 bg-white p-5 shadow-md space-y-4">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-600" />
                Reject Document Submission
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mandatory Document Rejection Reason *</label>
                <textarea
                  rows={3}
                  placeholder="Explain why the document was rejected (e.g. illegible scan, wrong file type)..."
                  value={docRejectReason}
                  onChange={(e) => setDocRejectReason(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setActiveModal('NONE');
                    setSelectedDocId(null);
                  }}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  disabled={actionLoading || !docRejectReason.trim()}
                  onClick={() => handleDocumentVerification(selectedDocId, 'REJECTED', docRejectReason)}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  Confirm Document Rejection
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Column (1 col wide): Stepper & Timeline */}
        <div className="space-y-6">

          {/* Workflow Stepper Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-3">
              Workflow Execution Sequence
            </h3>

            <div className="space-y-4">
              {steps.map((step) => {
                const isCompleted = step.stepOrder < request.currentStep || request.status === 'COMPLETED';
                const isCurrent = step.stepOrder === request.currentStep && request.status !== 'COMPLETED' && request.status !== 'REJECTED';

                return (
                  <div key={step.stepOrder} className="flex items-start gap-3 text-xs">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isCompleted ? 'bg-emerald-600 text-white' :
                      isCurrent ? 'bg-sky-600 text-white ring-4 ring-sky-100' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {isCompleted ? '✓' : step.stepOrder}
                    </div>

                    <div>
                      <div className={`font-semibold ${isCurrent ? 'text-sky-900 font-bold' : isCompleted ? 'text-slate-800' : 'text-slate-400'}`}>
                        {step.name}
                      </div>
                      <div className="text-slate-500 mt-0.5 text-[11px]">{step.description}</div>
                      {step.requiresDocuments && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          <FileCheck className="h-3 w-3 text-amber-600" /> Documents Required
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Persisted Audit Timeline */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              Persisted Audit History
            </h3>

            <div className="relative border-l-2 border-slate-100 pl-4 space-y-4">
              {timeline.map((event) => (
                <div key={event.id} className="relative text-xs">
                  <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-slate-300 ring-4 ring-white" />
                  <div className="font-semibold text-slate-900">{event.title}</div>
                  <div className="text-slate-600 text-[11px] mt-0.5">{event.description}</div>
                  <div className="text-slate-400 text-[10px] mt-1 flex items-center gap-2">
                    <span>{event.actorName} ({event.actorRole})</span>
                    <span>•</span>
                    <span>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
