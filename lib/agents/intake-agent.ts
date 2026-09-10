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

STRICT RULES:
1. You MUST ONLY choose a workflowKey from the provided active workflow list. DO NOT invent workflow keys.
2. Extract all relevant information from the student's request into extractedData matching the workflow's fields.
3. For standard fields that have clear contextual defaults in university workflows (e.g., deliveryPreference="Digital PDF", priority="High" or "Medium", leaveType="Medical" or "Casual", dates starting from current date, itemType="Campus ID Card" for lost IDs, requestType="Maintenance Request" for hostel repairs), populate them cleanly so students are not burdened with unnecessary friction.
4. If a genuinely required field is missing, state specifically what is needed (e.g. "I can process this as a Bona Fide Certificate request. What is the purpose of the certificate?").
5. DO NOT return a generic "Please provide more information" message when the student's intent is clear.
6. If confidence is below 0.60 or completely ambiguous, set workflowKey to null.

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
      const missingFieldLabels = missingFields.map((f) => {
        const fieldDef = matchedWorkflow?.requiredFields.find((rf) => rf.key === f);
        return fieldDef ? `"${fieldDef.label}"` : `"${f}"`;
      });
      explanation = `I can process this as a ${matchedWorkflow.title}. Please provide the required information: ${missingFieldLabels.join(', ')}.`;
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
