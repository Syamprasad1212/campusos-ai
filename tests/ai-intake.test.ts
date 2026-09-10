import { runIntakeAgent } from '../lib/agents/intake-agent';
import { getWorkflowByKey } from '../lib/workflows/definitions';
import { validateWorkflowData } from '../lib/workflows/service';
import { UserSession } from '../types';

export async function runAiIntakeTests() {
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

  // =========================================================================
  // NATURAL-LANGUAGE TEST SUITE (EXAMPLES A THROUGH H) - SAFETY & NON-FABRICATION
  // =========================================================================
  console.log('\n  --- Testing Mandatory Natural-Language Prompts (A-H) & Fact Non-Fabrication ---');

  // Example A: "I need a bonafide certificate for an education loan."
  const exA = await runIntakeAgent({
    userId: 'usr-student-alex',
    message: 'I need a bonafide certificate for an education loan.',
  });
  assert(
    exA.workflowKey === 'CERTIFICATE_REQUEST' &&
    exA.extractedData.certificateType === 'Bona Fide' &&
    typeof exA.extractedData.purpose === 'string' &&
    exA.extractedData.purpose.toLowerCase().includes('loan') &&
    exA.missingFields.length === 0 &&
    exA.nextAction === 'PREVIEW_WORKFLOW',
    'Example A: "I need a bonafide certificate for an education loan" -> Academic Certificate Request (Bona Fide, loan purpose, ready)'
  );

  // Example B: "I need proof that I am a student for my bank education loan."
  const exB = await runIntakeAgent({
    userId: 'usr-student-alex',
    message: 'I need proof that I am a student for my bank education loan.',
  });
  assert(
    exB.workflowKey === 'CERTIFICATE_REQUEST' &&
    exB.extractedData.certificateType === 'Bona Fide' &&
    typeof exB.extractedData.purpose === 'string' &&
    exB.missingFields.length === 0,
    'Example B: "I need proof that I am a student for my bank education loan" -> Academic Certificate Request (Bona Fide, loan purpose)'
  );

  // Example C: "I want to apply for leave because I am sick."
  const exC = await runIntakeAgent({
    userId: 'usr-student-alex',
    message: 'I want to apply for leave because I am sick.',
  });
  assert(
    exC.workflowKey === 'LEAVE_REQUEST' &&
    exC.extractedData.leaveType === 'Medical' &&
    exC.extractedData.startDate === undefined &&
    exC.extractedData.endDate === undefined &&
    exC.missingFields.includes('startDate') &&
    exC.missingFields.includes('endDate') &&
    exC.nextAction === 'ASK_FOR_INFORMATION' &&
    exC.explanation.toLowerCase().includes('date'),
    'Example C: "I want to apply for leave because I am sick" -> Leave Request (Medical, NO fabricated dates, asks for dates)'
  );

  // Example D: "I need permission to organize a technical event."
  const exD = await runIntakeAgent({
    userId: 'usr-student-alex',
    message: 'I need permission to organize a technical event.',
  });
  assert(
    exD.workflowKey === 'EVENT_PERMISSION' &&
    exD.extractedData.eventName === 'Technical Event' &&
    exD.extractedData.venue === undefined &&
    exD.extractedData.eventDate === undefined &&
    exD.extractedData.expectedParticipants === undefined &&
    exD.missingFields.includes('venue') &&
    exD.missingFields.includes('eventDate') &&
    exD.missingFields.includes('expectedParticipants') &&
    exD.nextAction === 'ASK_FOR_INFORMATION' &&
    (exD.explanation.toLowerCase().includes('venue') || exD.explanation.toLowerCase().includes('held')),
    'Example D: "I need permission to organize a technical event" -> Event Permission (NO fabricated venue/dates/participants, asks for missing fields)'
  );

  // Example E: "The projector in room 204 is not working."
  const exE = await runIntakeAgent({
    userId: 'usr-student-alex',
    message: 'The projector in room 204 is not working.',
  });
  assert(
    exE.workflowKey === 'CAMPUS_COMPLAINT' &&
    exE.extractedData.category !== 'HVAC' &&
    exE.extractedData.category === 'Electrical' &&
    exE.extractedData.location === 'Room 204',
    'Example E: "The projector in room 204 is not working" -> Campus Facility Complaint (Electrical, Room 204, NOT HVAC)'
  );

  // Example F: "I lost my student ID card."
  const exF = await runIntakeAgent({
    userId: 'usr-student-alex',
    message: 'I lost my student ID card.',
  });
  assert(
    exF.workflowKey === 'LOST_AND_FOUND' &&
    exF.extractedData.itemType === 'Campus ID Card' &&
    exF.extractedData.dateLostFound === undefined &&
    exF.missingFields.includes('dateLostFound') &&
    exF.nextAction === 'ASK_FOR_INFORMATION' &&
    (exF.explanation.toLowerCase().includes('date') || exF.explanation.toLowerCase().includes('when')),
    'Example F: "I lost my student ID card" -> Lost & Found (Campus ID Card, NO fabricated loss date, asks for date)'
  );

  // Example G: "I need help with my scholarship application."
  const exG = await runIntakeAgent({
    userId: 'usr-student-alex',
    message: 'I need help with my scholarship application.',
  });
  assert(
    exG.workflowKey === 'SCHOLARSHIP_ASSISTANCE' &&
    exG.extractedData.scholarshipType === undefined &&
    exG.extractedData.academicYear === undefined &&
    exG.extractedData.incomeDetails === undefined &&
    exG.missingFields.includes('scholarshipType') &&
    exG.missingFields.includes('academicYear') &&
    exG.missingFields.includes('incomeDetails') &&
    exG.nextAction === 'ASK_FOR_INFORMATION' &&
    exG.explanation.toLowerCase().includes('scholarship'),
    'Example G: "I need help with my scholarship application" -> Scholarship Assistance (NO fabricated income/year/scheme, asks specifically)'
  );

  // Example H: "I have a problem with hostel water."
  const exH = await runIntakeAgent({
    userId: 'usr-student-alex',
    message: 'I have a problem with hostel water.',
  });
  assert(
    exH.workflowKey === 'HOSTEL_REQUEST' &&
    exH.extractedData.requestType === 'Maintenance Request' &&
    exH.extractedData.currentRoom === undefined &&
    exH.missingFields.length === 0 &&
    exH.nextAction === 'PREVIEW_WORKFLOW',
    'Example H: "I have a problem with hostel water" -> Hostel Maintenance (NO fabricated room, optional room does not block, ready)'
  );

  console.log(`\n📊 AI Intake Test Summary: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAiIntakeTests();
}
