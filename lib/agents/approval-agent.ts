import { db } from '@/lib/db';
import { canAccessRequest, assertPermission } from '@/lib/permissions';
import { getWorkflowByKey, logAgentRun } from '@/lib/workflows/service';
import { UserSession } from '@/types';

export interface ApprovalAdvisoryOutput {
  requestId: string;
  summary: string;
  policyCheck: {
    passed: boolean;
    details: string[];
    documentsVerified: boolean;
    requiredFieldsComplete: boolean;
  };
  riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH';
  riskReasoning: string;
  recommendedAction: 'APPROVE' | 'REJECT' | 'REQUEST_INFORMATION';
  keyInsights: string[];
  confidence: number;
}

/**
 * AI Approval Intelligence Agent (ADVISORY MODE ONLY)
 * 
 * CRITICAL ARCHITECTURAL RULES:
 * 1. AI Approval Agent is strictly ADVISORY. It NEVER mutates request status or approves/rejects workflows.
 * 2. All policy boundaries MUST come from configured workflow step definitions and DB verified documents.
 * 3. The AI MUST NOT invent university policies, extra required documents, or approval authority.
 */
export async function runApprovalAgent(
  requestId: string,
  userSession: UserSession
): Promise<ApprovalAdvisoryOutput> {
  const startTime = Date.now();

  // 1. Fetch Request with full relations
  const request = await db.request.findUnique({
    where: { id: requestId },
    include: {
      student: true,
      workflow: true,
      department: true,
      requestData: true,
      tasks: true,
      documents: true,
      auditLogs: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!request) {
    throw new Error(`[REQUEST_NOT_FOUND] Request with ID "${requestId}" not found.`);
  }

  // 2. Authorization Security Check
  assertPermission(
    canAccessRequest(userSession, request.studentId, request.departmentId),
    'You are not authorized to view approval advisory for this request'
  );

  // 3. Load Workflow Definition & Step Configuration
  const wfDef = getWorkflowByKey(request.workflow.key);
  const currentStepDef = wfDef?.stepSequence[request.currentStep - 1];

  const formData = (request.requestData?.formData as Record<string, any>) || {};
  const detailsList: string[] = [];
  const keyInsights: string[] = [];

  // 4. Deterministic Policy Checks against Application Configuration (NO invented rules)
  let requiredFieldsComplete = true;
  if (wfDef) {
    for (const field of wfDef.requiredFields) {
      if (field.required && (formData[field.key] === undefined || formData[field.key] === null || formData[field.key] === '')) {
        requiredFieldsComplete = false;
        detailsList.push(`Missing required field: "${field.label}"`);
      }
    }
  }

  let documentsVerified = true;
  if (currentStepDef?.requiresDocuments) {
    const verifiedDocs = request.documents.filter((d) => d.verificationStatus === 'VERIFIED');
    const unverifiedDocs = request.documents.filter((d) => d.verificationStatus !== 'VERIFIED');

    if (request.documents.length === 0) {
      documentsVerified = false;
      detailsList.push('Required document missing from submission');
    } else if (unverifiedDocs.length > 0) {
      documentsVerified = false;
      detailsList.push(`${unverifiedDocs.length} document(s) awaiting verification (${unverifiedDocs.map((d) => d.fileName).join(', ')})`);
    } else {
      detailsList.push(`All ${verifiedDocs.length} required document(s) verified by staff`);
    }
  } else {
    detailsList.push('No mandatory documents required for current workflow step');
  }

  const passedPolicyCheck = requiredFieldsComplete && (currentStepDef?.requiresDocuments ? documentsVerified : true);

  // 5. Risk Assessment & Recommended Action Formulation
  let riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  let recommendedAction: 'APPROVE' | 'REJECT' | 'REQUEST_INFORMATION' = 'APPROVE';
  let riskReasoning = 'Request meets all configured workflow step criteria and document verification requirements.';

  if (!passedPolicyCheck) {
    riskAssessment = 'MEDIUM';
    recommendedAction = 'REQUEST_INFORMATION';
    riskReasoning = 'Incomplete required fields or pending document verification.';
    keyInsights.push('Advisory: Recommend requesting missing information or completing document verification before final signoff.');
  }

  const rejectedDocs = request.documents.filter((d) => d.verificationStatus === 'REJECTED');
  if (rejectedDocs.length > 0) {
    riskAssessment = 'HIGH';
    recommendedAction = 'REJECT';
    riskReasoning = `Submission contains ${rejectedDocs.length} rejected document(s).`;
    keyInsights.push(`Critical Flag: Document "${rejectedDocs[0].fileName}" was rejected by staff.`);
  }

  keyInsights.push(`Student: ${request.student.name} (${request.student.email})`);
  keyInsights.push(`Workflow: ${request.workflow.name} — Step ${request.currentStep}: ${currentStepDef?.name || 'Review'}`);

  const advisoryOutput: ApprovalAdvisoryOutput = {
    requestId,
    summary: `Approval Advisory for ${request.title}: Student ${request.student.name} requested ${request.workflow.name} in ${request.department.name}.`,
    policyCheck: {
      passed: passedPolicyCheck,
      details: detailsList,
      documentsVerified,
      requiredFieldsComplete,
    },
    riskAssessment,
    riskReasoning,
    recommendedAction,
    keyInsights,
    confidence: passedPolicyCheck ? 0.95 : 0.75,
  };

  // 6. Log AgentRun Telemetry
  await logAgentRun({
    agentType: 'APPROVAL_AGENT',
    actorId: userSession.id,
    requestId,
    promptInput: `Approval Advisory Analysis for request ${requestId} (${request.workflow.key})`,
    aiOutputJson: JSON.parse(JSON.stringify(advisoryOutput)),
    executionTimeMs: Date.now() - startTime,
    status: 'COMPLETED',
  });

  return advisoryOutput;
}
