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

  const systemPrompt = `You are the CampusOS AI Intake Agent.
Your job is to match a student's natural-language request to ONE valid workflow definition.

STRICT RULES:
1. You MUST ONLY choose a workflowKey from the provided active workflow list. DO NOT invent workflow keys.
2. Extract any data fields provided in the user prompt matching the workflow's required fields.
3. If confidence is below 0.60 or ambiguous, set workflowKey to null.

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

  if (matchedWorkflow && finalWorkflowKey) {
    const validation = validateWorkflowData(matchedWorkflow, aiResult.extractedData || {});
    missingFields = validation.errors.map((e) => e.field);

    if (finalConfidence < 0.6) {
      nextAction = 'CLARIFY';
    } else if (missingFields.length > 0) {
      nextAction = 'ASK_FOR_INFORMATION';
    } else {
      nextAction = 'PREVIEW_WORKFLOW';
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
    explanation: aiResult.explanation || 'Processed natural-language request.',
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
