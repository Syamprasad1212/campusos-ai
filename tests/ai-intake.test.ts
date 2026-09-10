import { runIntakeAgent } from '../lib/agents/intake-agent';
import { getWorkflowByKey } from '../lib/workflows/definitions';
import { validateWorkflowData } from '../lib/workflows/service';
import { UserSession } from '../types';

async function runAiIntakeTests() {
  console.log('🧪 Starting CampusOS AI Intake Agent & Workflow Intelligence Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Natural Language Request -> Correct Workflow Matching
  const certResult = await runIntakeAgent({
    userId: 'usr-student-alex',
    message: 'I need a bona fide certificate for an education loan application using speed post delivery',
  });

  assert(
    certResult.workflowKey === 'CERTIFICATE_REQUEST',
    'Classify "bona fide certificate" to CERTIFICATE_REQUEST workflow'
  );
  assert(
    certResult.extractedData.certificateType === 'Bona Fide',
    'Extract certificateType = "Bona Fide"'
  );
  assert(
    certResult.extractedData.deliveryPreference === 'Speed Post',
    'Extract deliveryPreference = "Speed Post"'
  );

  // 2. Missing Required Information Detection
  const missingCertResult = await runIntakeAgent({
    userId: 'usr-student-alex',
    message: 'I need a transcript certificate',
  });

  assert(
    missingCertResult.workflowKey === 'CERTIFICATE_REQUEST',
    'Classify "transcript certificate" to CERTIFICATE_REQUEST'
  );
  assert(
    missingCertResult.missingFields.includes('purpose'),
    'Detect missing required field "purpose"'
  );
  assert(
    missingCertResult.nextAction === 'ASK_FOR_INFORMATION',
    'Set nextAction = "ASK_FOR_INFORMATION" when required fields are missing'
  );

  // 3. Complaint Workflow Intent Matching
  const complaintResult = await runIntakeAgent({
    userId: 'usr-student-alex',
    message: 'The classroom AC in Room 302 is broken and leaking water',
  });

  assert(
    complaintResult.workflowKey === 'CAMPUS_COMPLAINT',
    'Classify maintenance prompt to CAMPUS_COMPLAINT workflow'
  );
  assert(
    complaintResult.extractedData.category === 'HVAC' || complaintResult.extractedData.category === 'Plumbing' || complaintResult.extractedData.category === 'Electrical',
    'Extract complaint category'
  );

  // 4. Low Confidence / Ambiguous Request -> CLARIFY Fallback
  const ambiguousResult = await runIntakeAgent({
    userId: 'usr-student-alex',
    message: 'Hello campus',
  });

  assert(
    ambiguousResult.workflowKey === null,
    'Return workflowKey = null for ambiguous input'
  );
  assert(
    ambiguousResult.nextAction === 'CLARIFY',
    'Set nextAction = "CLARIFY" when confidence is low'
  );

  // 5. Deterministic Field Validation Integration
  const wfDef = getWorkflowByKey('CERTIFICATE_REQUEST');
  if (wfDef) {
    const invalidVal = validateWorkflowData(wfDef, {
      certificateType: 'NonExistentType',
      purpose: 'Loan',
      deliveryPreference: 'Digital PDF',
    });
    assert(
      invalidVal.valid === false && invalidVal.errors.some((e) => e.field === 'certificateType'),
      'Deterministic validation rejects invalid select option'
    );
  }

  // 6. Workflow Preview Generation
  assert(
    certResult.workflowPreview !== undefined && certResult.workflowPreview.stepSequence.length > 0,
    'Generate structured workflow preview with step sequence'
  );

  console.log(`\n📊 AI Intake Test Summary: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAiIntakeTests();
