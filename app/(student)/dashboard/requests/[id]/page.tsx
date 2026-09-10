'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  HelpCircle, 
  FileText, 
  Building2, 
  AlertCircle,
  Send,
  Upload,
  ExternalLink,
  ShieldCheck,
  FileCheck,
  XCircle
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
}

interface StepDef {
  stepOrder: number;
  name: string;
  description: string;
  roleRequired: string;
  requiresDocuments?: boolean;
}

interface DocumentItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  documentType?: string;
  verificationStatus: string;
  createdAt: string;
  signedUrl?: string;
  notes?: string;
}

interface TimelineItem {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  actorName: string;
  actorRole: string;
  type: string;
}

export default function StudentRequestTrackingPage({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [steps, setSteps] = useState<StepDef[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  // Response field state for Information Required prompt
  const [infoInputValue, setInfoInputValue] = useState('');

  // Upload Form State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docTypeSelection, setDocTypeSelection] = useState('STUDENT_ID');

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(`/api/requests/${params.id}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to fetch request details');
      }

      setRequest(json.data.request);
      setTimeline(json.data.timeline || []);
      if (json.data.workflowDefinition?.stepSequence) {
        setSteps(json.data.workflowDefinition.stepSequence);
      }

      // Fetch uploaded documents
      const docsRes = await fetch(`/api/requests/${params.id}/documents`);
      const docsJson = await docsRes.json();
      if (docsRes.ok && docsJson.success) {
        setDocuments(docsJson.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading request');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [params.id]);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    try {
      setUploadLoading(true);
      setError(null);
      setSuccessMsg(null);

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('documentType', docTypeSelection);

      const res = await fetch(`/api/requests/${params.id}/documents`, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to upload document');
      }

      setSuccessMsg('Document uploaded and processed successfully!');
      setUploadFile(null);
      await fetchDetails();
    } catch (err: any) {
      setError(err.message || 'Document upload error');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleProvideInformation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request || !infoInputValue.trim()) return;

    try {
      setSubmitLoading(true);
      setError(null);
      setSuccessMsg(null);

      const targetField = request.requestData?.metadata?.informationRequest?.field || 'additionalInfo';

      const res = await fetch(`/api/requests/${params.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PROVIDE_INFORMATION',
          field: targetField,
          value: infoInputValue.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to submit response');
      }

      setSuccessMsg('Information submitted successfully! Workflow processing resumed.');
      setInfoInputValue('');
      await fetchDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to submit information');
    } finally {
      setSubmitLoading(false);
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
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <h3 className="font-bold">Error Loading Request</h3>
        </div>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        <Link href="/dashboard/requests" className="mt-4 inline-flex items-center text-xs font-semibold text-red-700 hover:underline">
          ← Return to My Requests
        </Link>
      </div>
    );
  }

  if (!request) return null;

  const currentStepDef = steps.find((s) => s.stepOrder === request.currentStep);
  const infoReq = request.requestData?.metadata?.informationRequest;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Navigation */}
      <div>
        <Link href="/dashboard/requests" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Back to My Requests
        </Link>
      </div>

      {/* Feedback Notifications */}
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

      {/* Request Header Card */}
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

          <div>
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

        {/* Metadata Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Handling Department</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">{request.department.name}</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Current Step</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">
              Step {request.currentStep}: {currentStepDef?.name || 'Processing'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Submitted On</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">
              {new Date(request.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Last Updated</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">
              {new Date(request.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Information Required Action Form Banner */}
      {request.status === 'INFORMATION_REQUIRED' && infoReq && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-900 text-base">Information Required to Proceed</h3>
              <p className="text-xs text-amber-800 mt-1">
                Staff member requested information for field: <span className="font-bold">{infoReq.field}</span>
              </p>
              <div className="mt-2 rounded-lg bg-white/80 border border-amber-200 p-3 text-xs text-amber-900 font-medium">
                "{infoReq.message}"
              </div>
            </div>
          </div>

          <form onSubmit={handleProvideInformation} className="pt-2 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-amber-900 mb-1">
                Provide Response for <span className="font-mono text-amber-700">{infoReq.field}</span> *
              </label>
              <input
                type="text"
                required
                placeholder={`Enter your ${infoReq.field}...`}
                value={infoInputValue}
                onChange={(e) => setInfoInputValue(e.target.value)}
                className="w-full text-xs rounded-lg border border-amber-300 px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitLoading || !infoInputValue.trim()}
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              <Send className="h-4 w-4" />
              Submit Response to Staff
            </button>
          </form>
        </div>
      )}

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Data & Document Upload */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Submitted Request Data */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-sky-600" />
              Submitted Application Details
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
              <p className="text-xs text-slate-500 italic">No additional form fields attached.</p>
            )}
          </div>

          {/* Document Management Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-sky-600" />
                Required Documents & Attachments
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">PDF, PNG, JPG (Max 10 MB)</span>
            </div>

            {/* Document Upload Form */}
            <form onSubmit={handleFileUpload} className="rounded-xl border border-dashed border-sky-300 bg-sky-50/40 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Document Category</label>
                  <select
                    value={docTypeSelection}
                    onChange={(e) => setDocTypeSelection(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="STUDENT_ID">Student ID Card</option>
                    <option value="FEE_RECEIPT">Fee Receipt / Voucher</option>
                    <option value="IDENTITY_PROOF">Government Identity Proof</option>
                    <option value="SUPPORTING_DOCUMENT">Supporting Document</option>
                    <option value="CERTIFICATE">Academic Certificate</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Choose File</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    required
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-1">
                <button
                  type="submit"
                  disabled={uploadLoading || !uploadFile}
                  className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm disabled:opacity-50 transition"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadLoading ? 'Uploading & Processing...' : 'Upload Document'}
                </button>
              </div>
            </form>

            {/* List of Uploaded Documents */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase">Uploaded Documents ({documents.length})</h4>
              
              {documents.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No documents uploaded for this request yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {documents.map((doc) => (
                    <div key={doc.id} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-sky-600 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-900 block">{doc.fileName}</span>
                          <span className="text-[11px] text-slate-500">
                            Type: <strong className="text-slate-700">{doc.documentType || 'General'}</strong> • {(doc.fileSize / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
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
                            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800"
                          >
                            <span>View</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Side: Step Stepper & Timeline */}
        <div className="space-y-6">
          
          {/* Stepper Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-3">
              Workflow Steps Progress
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
                          <FileCheck className="h-3 w-3 text-amber-600" /> Document Verification Required
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
              Real-time Activity Timeline
            </h3>

            <div className="relative border-l-2 border-slate-100 pl-4 space-y-4">
              {timeline.map((event) => (
                <div key={event.id} className="relative text-xs">
                  <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-slate-300 ring-4 ring-white" />
                  <div className="font-semibold text-slate-900">{event.title}</div>
                  <div className="text-slate-600 text-[11px] mt-0.5">{event.description}</div>
                  <div className="text-slate-400 text-[10px] mt-1 flex items-center gap-2">
                    <span>{event.actorName}</span>
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
