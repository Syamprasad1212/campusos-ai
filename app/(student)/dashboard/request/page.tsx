'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Building2,
  Layers,
  HelpCircle,
  Check,
  RotateCcw,
} from 'lucide-react';

interface WorkflowPreview {
  title: string;
  description: string;
  departmentCode: string;
  departmentName?: string;
  pattern: string;
  stepSequence: Array<{
    stepOrder: number;
    name: string;
    roleRequired: string;
    description: string;
    requiresDocuments?: boolean;
    requiresApproval?: boolean;
  }>;
  requiredDocuments?: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
    stepOrder: number;
  }>;
  submissionNotice?: string;
}

interface IntakeResult {
  intent: string;
  category: string;
  confidence: number;
  workflowKey: string | null;
  extractedData: Record<string, any>;
  missingFields: string[];
  explanation: string;
  nextAction: 'ASK_FOR_INFORMATION' | 'PREVIEW_WORKFLOW' | 'CREATE_REQUEST' | 'CLARIFY';
  workflowPreview?: WorkflowPreview;
}

export default function StudentAIRequestPage() {
  const router = useRouter();

  const [prompt, setPrompt] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [intakeResult, setIntakeResult] = useState<IntakeResult | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [createdRequest, setCreatedRequest] = useState<any | null>(null);

  const examplePrompts = [
    'I need a bonafide certificate for an education loan',
    'I want to report a broken classroom AC in Room 302',
    'Applying for 3 days of medical leave for hospital treatment',
    'Requesting permission for a student tech workshop in Seminar Hall A',
  ];

  async function handleAnalyze(customPrompt?: string) {
    const textToAnalyze = customPrompt || prompt;
    if (!textToAnalyze.trim()) return;

    setAnalyzing(true);
    setError(null);
    setIntakeResult(null);

    try {
      const res = await fetch('/api/ai/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToAnalyze }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to analyze request intent');
      }

      const data: IntakeResult = json.data;
      setIntakeResult(data);
      setFormData(data.extractedData || {});
    } catch (err: any) {
      setError(err.message || 'An error occurred during AI analysis');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleConfirmSubmit() {
    if (!intakeResult || !intakeResult.workflowKey || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const idempotencyKey = `intake_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const res = await fetch('/api/ai/intake/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowKey: intakeResult.workflowKey,
          data: formData,
          title: `${intakeResult.workflowPreview?.title || 'Campus Request'}`,
          summary: prompt,
          idempotencyKey,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to create workflow request');
      }

      setCreatedRequest(json.data);
    } catch (err: any) {
      setError(err.message || 'Workflow confirmation failed');
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setPrompt('');
    setIntakeResult(null);
    setFormData({});
    setCreatedRequest(null);
    setError(null);
  }

  const hasRequiredDocs = (intakeResult?.workflowPreview?.requiredDocuments?.length || 0) > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sky-700 font-semibold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="h-4 w-4" />
            <span>AI Workflow Intelligence Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">CampusOS Request Assistant</h1>
          <p className="text-slate-600 text-sm">Describe what you need in plain English. CampusOS matches the workflow, surfaces mandatory requirements, and routes it automatically.</p>
        </div>

        {intakeResult && !createdRequest && (
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Start Over</span>
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* SUCCESS CONFIRMATION STATE */}
      {createdRequest ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-8 text-center space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900">Workflow Request Submitted!</h2>
            <p className="text-slate-600 text-sm mt-1">Your request has been validated, assigned, and routed to the correct university department.</p>
          </div>

          <div className="mx-auto max-w-md bg-white p-5 rounded-xl border border-emerald-200 text-left text-sm space-y-2.5 shadow-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Reference No:</span>
              <span className="font-mono font-bold text-slate-900">{createdRequest.referenceNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status:</span>
              <span className="font-semibold text-emerald-700">{createdRequest.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Handling Department:</span>
              <span className="font-semibold text-slate-800">{intakeResult?.workflowPreview?.departmentName || intakeResult?.workflowPreview?.departmentCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Current Step:</span>
              <span>Step 1 ({intakeResult?.workflowPreview?.stepSequence[0]?.name || 'Verification'})</span>
            </div>

            {hasRequiredDocs && (
              <div className="pt-2 border-t border-slate-100 text-xs text-amber-800 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200">
                <span className="font-bold block mb-0.5">⚠ Action Recommended:</span>
                Please upload the required <span className="font-semibold">{intakeResult?.workflowPreview?.requiredDocuments?.[0]?.name}</span> so staff can complete Step 1 verification.
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <button
              onClick={() => router.push(`/dashboard/requests/${createdRequest.id}`)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 text-white font-medium text-sm hover:bg-sky-700 shadow transition"
            >
              <span>{hasRequiredDocs ? 'Upload Required Documents & View Request' : 'View Request Details'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 transition"
            >
              Go to Student Portal
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* STEP 1: Natural Language Entry */}
          {!intakeResult && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white p-6 sm:p-8 shadow-sm">
                <label className="block text-lg font-bold text-slate-900 mb-2">
                  What do you need help with?
                </label>
                <p className="text-sm text-slate-600 mb-4">
                  Describe your campus request naturally. Mention any key details like reasons, dates, or options.
                </p>

                <div className="relative">
                  <textarea
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 text-sm"
                    placeholder="e.g. I need a bona fide certificate for an education loan application..."
                  />
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      disabled={analyzing || !prompt.trim()}
                      onClick={() => handleAnalyze()}
                      className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700 transition disabled:opacity-50"
                    >
                      {analyzing ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Analyzing Intent...</span>
                        </>
                      ) : (
                        <>
                          <span>Analyze Request</span>
                          <Sparkles className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Example Quick Triggers */}
                <div className="mt-6 pt-4 border-t border-sky-100 flex flex-col gap-2">
                  <span className="text-xs font-semibold text-slate-500">Try these examples:</span>
                  <div className="flex flex-wrap gap-2">
                    {examplePrompts.map((ex, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setPrompt(ex);
                          handleAnalyze(ex);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-sky-300 hover:bg-sky-50 transition text-left"
                      >
                        "{ex}"
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 & 4: AI Analysis & Workflow Preview */}
          {intakeResult && (
            <div className="space-y-6">
              {/* CLARIFY FALLBACK STATE */}
              {intakeResult.nextAction === 'CLARIFY' || !intakeResult.workflowKey ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 space-y-4">
                  <div className="flex items-center gap-2 text-amber-800 font-bold">
                    <HelpCircle className="h-5 w-5 text-amber-600" />
                    <span>Clarity Required</span>
                  </div>
                  <p className="text-sm text-slate-700">{intakeResult.explanation}</p>
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium text-xs hover:bg-amber-700 transition"
                  >
                    Try rephrasing your request
                  </button>
                </div>
              ) : (
                <>
                  {/* WORKFLOW PREVIEW CARD */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-sky-700 uppercase tracking-wider px-2.5 py-1 bg-sky-50 border border-sky-200 rounded-md">
                            Workflow: {intakeResult.workflowKey}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200">
                            <Building2 className="h-3.5 w-3.5 text-slate-500" />
                            <span>Handled by: <strong className="text-slate-900">{intakeResult.workflowPreview?.departmentName || intakeResult.workflowPreview?.departmentCode}</strong></span>
                          </span>
                        </div>
                        <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
                          {intakeResult.workflowPreview?.title}
                        </h2>
                        <p className="text-slate-600 text-sm mt-1">{intakeResult.workflowPreview?.description}</p>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="text-xs font-semibold text-slate-500">AI Confidence</span>
                        <div className="text-lg font-bold text-emerald-600">{Math.round(intakeResult.confidence * 100)}%</div>
                      </div>
                    </div>

                    {/* Advance Document Notice if workflow has mandatory documents */}
                    {hasRequiredDocs && (
                      <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>Required Document Preview (Mandatory for Step 1)</span>
                        </div>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          {intakeResult.workflowPreview?.submissionNotice || 
                            'Your request can be submitted now, but staff cannot process Step 1 until the required document is uploaded.'}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {intakeResult.workflowPreview?.requiredDocuments?.map((doc, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-lg border border-amber-200 text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900">{doc.name}</span>
                                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-amber-100 text-amber-900 rounded">
                                  {doc.type}
                                </span>
                              </div>
                              <p className="text-slate-500 text-[11px]">{doc.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Process Steps Preview */}
                    <div>
                      <h3 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center gap-1.5">
                        <Layers className="h-4 w-4" />
                        <span>Automated University Process Sequence</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {intakeResult.workflowPreview?.stepSequence.map((step) => (
                          <div key={step.stepOrder} className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                            <div className="font-semibold text-slate-900">Step {step.stepOrder}: {step.name}</div>
                            <div className="text-slate-500 mt-0.5">Role: <span className="font-medium text-sky-700">{step.roleRequired}</span></div>
                            <div className="text-slate-600 mt-1">{step.description}</div>
                            {step.requiresDocuments && (
                              <div className="mt-2 text-[11px] font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded inline-block">
                                ⚠ Document verification required
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Form Data & Missing Fields Collection */}
                    <div className="border-t border-slate-100 pt-6 space-y-4">
                      <h3 className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1.5">
                        <FileText className="h-4 w-4" />
                        <span>Required Information Checklist</span>
                      </h3>

                      <div className="space-y-3 max-w-xl">
                        {Object.entries(formData).map(([key, val]) => (
                          <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50 text-sm">
                            <span className="font-semibold text-slate-700 capitalize flex items-center gap-1.5">
                              <Check className="h-4 w-4 text-emerald-600" />
                              {key.replace(/([A-Z])/g, ' $1')}
                            </span>
                            <input
                              type="text"
                              value={String(val || '')}
                              onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                              className="rounded border border-slate-300 px-2.5 py-1 text-xs bg-white text-slate-900 focus:outline-none focus:border-sky-500"
                            />
                          </div>
                        ))}

                        {intakeResult.missingFields.map((fieldKey) => (
                          <div key={fieldKey} className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm space-y-1">
                            <label className="block text-xs font-bold text-amber-900 capitalize">
                              Missing Field: {fieldKey.replace(/([A-Z])/g, ' $1')} *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder={`Enter ${fieldKey}...`}
                              value={formData[fieldKey] || ''}
                              onChange={(e) => setFormData({ ...formData, [fieldKey]: e.target.value })}
                              className="w-full rounded border border-amber-300 px-3 py-1.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CONFIRMATION ACTION BUTTON */}
                    <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="text-xs text-slate-500">
                        {intakeResult.missingFields.length > 0 ? (
                          <span className="text-amber-700 font-medium">Please fill in missing fields above to proceed</span>
                        ) : (
                          <span className="text-emerald-700 font-medium">✓ All required information ready for submission</span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={submitting || intakeResult.missingFields.length > 0}
                        onClick={handleConfirmSubmit}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700 transition disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>Submitting Workflow...</span>
                          </>
                        ) : (
                          <>
                            <span>Confirm & Submit Request</span>
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

