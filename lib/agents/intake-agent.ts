/**
 * CampusOS AI Intake Agent
 * 
 * RESPONSIBILITIES:
 * 1. Understand natural-language student requests.
 * 2. Match request intent to valid workflow definitions (from application source of truth).
 * 3. Extract structured data fields from user prompt.
 * 4. Determine missing required fields deterministically via Workflow Service.
 * 5. Generate structured workflow preview for student review & confirmation.
 * 6. Record AgentRun execution telemetry via Agent Tool contract.
 */

import { generateStructuredResponse } from '@/lib/ai/provider';
import { toolGetActiveWorkflows, toolLogAgentRun } from '@/lib/agents/tools';
import { validateWorkflowData } from '@/lib/workflows/service';
import { WorkflowDefinition } from '@/types';

export type IntakeNextAction = 'ASK_FOR_INFORMATION' | 'PREVIEW_WORKFLOW' | 'CREATE_REQUEST' | 'CLARIFY';

export interface IntakeAgentResult {
  intent: string;
  category: string;
  confidence: number;
  workflowKey: string | null;
  extractedData: Record<string, unknown>;
  missingFields: string[];
  explanation: string;
  nextAction: IntakeNextAction;
  workflowPreview?: {
    title: string;
    description: string;
    departmentCode: string;
    pattern: string;
    stepSequence: Array<{
      stepOrder: number;
      name: string;
      roleRequired: string;
      description: string;
    }>;
  };
}

export async function runIntakeAgent(input: {
  userId: string;
  message: string;
  conversationContext?: unknown;
}): Promise<IntakeAgentResult> {
  const startTime = Date.now();

  // 1. Fetch available workflow definitions from controlled agent tool
  const activeWorkflows = await toolGetActiveWorkflows();

  const workflowSummaries = activeWorkflows.map((wf) => ({
    key: wf.key,
    title: wf.title,
    description: wf.description,
    category: wf.category,
    requiredFields: wf.requiredFields.map((f) => ({ key: f.key, label: f.label, required: f.required })),
  }));

  const systemPrompt = `You are the CampusOS AI Intake Agent for university operations.
Your job is to match a student's natural-language request to ONE valid workflow definition.

CORE PRINCIPLES:
1. INFER INTENT AGGRESSIVELY: Match the student's request to the correct workflowKey from the provided active workflow list. DO NOT invent workflow keys.
2. INFER FACTS CONSERVATIVELY: Extract structured facts into extractedData.
   - ONLY extract fields explicitly stated or safely and unmistakably implied by the user's wording (e.g., "sick" -> leaveType="Medical", "bona fide" -> certificateType="Bona Fide", "lost student ID card" -> itemType="Campus ID Card", "problem with hostel water" -> requestType="Maintenance Request").
   - NEVER silently fabricate or invent user facts: do NOT invent dates, times, venues, participant counts, room numbers/locations, income amounts, scholarship schemes, academic years, course codes, or company names.
   - For standard workflow system defaults explicitly defined by the workflow (e.g. deliveryPreference="Digital PDF" in certificate requests, priority="Medium" or "High" in maintenance complaints), safe system defaults may be populated.
   - If a required fact is missing, omit it from extractedData so the system can ask specifically for it.
3. If confidence is below 0.60 or completely ambiguous, set workflowKey to null.

AVAILABLE WORKFLOWS:
${JSON.stringify(workflowSummaries, null, 2)}`;

  const prompt = `Student Request: "${input.message}"`;

  let aiResult: {
    workflowKey: string | null;
    intent: string;
    confidence: number;
    extractedData: Record<string, unknown>;
    explanation: string;
  };

  try {
    aiResult = await generateStructuredResponse(prompt, systemPrompt, { temperature: 0.1 });
  } catch (error: any) {
    aiResult = {
      workflowKey: null,
      intent: 'Request classification fallback',
      confidence: 0.0,
      extractedData: {},
      explanation: 'AI classification error. Falling back to manual selection.',
    };
  }

  // 2. Validate workflowKey against application source of truth
  let matchedWorkflow: WorkflowDefinition | undefined;
  if (aiResult.workflowKey) {
    matchedWorkflow = activeWorkflows.find((wf) => wf.key === aiResult.workflowKey);
  }

  let finalWorkflowKey: string | null = matchedWorkflow ? matchedWorkflow.key : null;
  let finalConfidence = aiResult.confidence ?? 0.5;

  if (!matchedWorkflow) {
    finalWorkflowKey = null;
    finalConfidence = 0.3;
  }

  // 3. Deterministic Backend Field Validation (Authoritative)
  let missingFields: string[] = [];
  let nextAction: IntakeNextAction = 'CLARIFY';
  let workflowPreview: IntakeAgentResult['workflowPreview'] = undefined;
  let explanation = aiResult.explanation || 'Processed natural-language request.';

  if (matchedWorkflow && finalWorkflowKey) {
    const validation = validateWorkflowData(matchedWorkflow, aiResult.extractedData || {});
    missingFields = validation.errors.map((e) => e.field);

    if (finalConfidence < 0.6) {
      nextAction = 'CLARIFY';
      explanation = `I could not clearly match your request to an existing campus workflow. Please rephrase or specify if this is a certificate, leave, maintenance, or permission request.`;
    } else if (missingFields.length > 0) {
      nextAction = 'ASK_FOR_INFORMATION';
      explanation = buildTargetedMissingFieldsQuestion(matchedWorkflow, missingFields, aiResult.extractedData || {});
    } else {
      nextAction = 'PREVIEW_WORKFLOW';
      explanation = `Matched request to ${matchedWorkflow.title}. All required details are ready for confirmation.`;
    }

    workflowPreview = {
      title: matchedWorkflow.title,
      description: matchedWorkflow.description,
      departmentCode: matchedWorkflow.departmentCode,
      pattern: matchedWorkflow.pattern,
      stepSequence: matchedWorkflow.stepSequence.map((s) => ({
        stepOrder: s.stepOrder,
        name: s.name,
        roleRequired: s.roleRequired,
        description: s.description,
      })),
    };
  }

  const result: IntakeAgentResult = {
    intent: aiResult.intent || 'Campus request processing',
    category: matchedWorkflow ? matchedWorkflow.category : 'GENERAL',
    confidence: finalConfidence,
    workflowKey: finalWorkflowKey,
    extractedData: aiResult.extractedData || {},
    missingFields,
    explanation,
    nextAction,
    workflowPreview,
  };

  // 4. Log AgentRun Telemetry
  const executionTimeMs = Date.now() - startTime;
  await toolLogAgentRun({
    agentType: 'INTAKE_AGENT',
    actorId: input.userId,
    promptInput: input.message,
    aiOutputJson: JSON.parse(JSON.stringify(result)),
    status: 'COMPLETED',
    executionTimeMs,
  });

  return result;
}

/**
 * Build human-friendly targeted questions for missing required fields
 */
function buildTargetedMissingFieldsQuestion(
  workflow: WorkflowDefinition,
  missingFields: string[],
  extractedData: Record<string, unknown>
): string {
  // 1. Leave Requests
  if (workflow.key === 'LEAVE_REQUEST' && (missingFields.includes('startDate') || missingFields.includes('endDate'))) {
    const leaveType = extractedData.leaveType ? ` (${extractedData.leaveType})` : '';
    return `I can process this as a Leave Application${leaveType}. What date should your leave start, and when should it end?`;
  }

  // 2. Event Permissions
  if (workflow.key === 'EVENT_PERMISSION') {
    return `I can process this as a Campus Event Approval request. What date is the event, where will it be held (e.g. Main Auditorium, Seminar Hall A, Open Air Theatre, Sports Ground), and approximately how many participants are expected?`;
  }

  // 3. Lost and Found
  if (workflow.key === 'LOST_AND_FOUND' && missingFields.includes('dateLostFound')) {
    const itemType = extractedData.itemType ? ` for your ${extractedData.itemType}` : '';
    return `I can process this as a Lost ID & Belongings Claim${itemType}. On what date was the item lost or found?`;
  }

  // 4. Scholarship Assistance
  if (workflow.key === 'SCHOLARSHIP_ASSISTANCE') {
    return `I can process this as a Scholarship Assistance Application. Please specify the scholarship scheme, academic year, and your family's annual income details.`;
  }

  // 5. Campus Complaints
  if (workflow.key === 'CAMPUS_COMPLAINT' && missingFields.includes('location')) {
    return `I can process this as a Campus Facility Complaint. What is the location or room number of the issue?`;
  }

  // 6. Certificate Requests
  if (workflow.key === 'CERTIFICATE_REQUEST' && missingFields.includes('purpose')) {
    const certType = extractedData.certificateType ? ` for a ${extractedData.certificateType}` : '';
    return `I can process this as an Academic Certificate Request${certType}. What is the specific purpose of the certificate (e.g. Bank Loan, Higher Studies, Visa, Job Application)?`;
  }

  // 7. General Workflow Fallback with precise labels
  const missingFieldLabels = missingFields.map((f) => {
    const fieldDef = workflow.requiredFields.find((rf) => rf.key === f);
    return fieldDef ? `"${fieldDef.label}"` : `"${f}"`;
  });
  return `I can process this as a ${workflow.title}. Please provide the required information: ${missingFieldLabels.join(', ')}.`;
}
