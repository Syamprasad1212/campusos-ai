import { WorkflowDefinition, WorkflowRequirements, DocumentRequirement } from '@/types';

export const DEPARTMENT_NAMES: Record<string, string> = {
  REGISTRAR: 'Registrar & Academic Records',
  ACADEMIC_AFFAIRS: 'Academic Affairs',
  STUDENT_AFFAIRS: 'Office of Student Affairs',
  EXAM_CELL: 'Examination Cell',
  FINANCE: 'Finance & Accounts',
  FINANCIAL_AID: 'Scholarship & Financial Aid',
  HOSTEL_ADMIN: 'Hostel Administration',
  TRANSPORT: 'Campus Transport Services',
  CAREER_CELL: 'Career Development & Placement Cell',
  IT_SUPPORT: 'IT & Infrastructure Support',
  STUDENT_CLUBS: 'Student Clubs & Societies',
  CAMPUS_OPS: 'Campus Operations & Security',
};

export const WORKFLOW_DOCUMENT_SPECS: Record<string, DocumentRequirement[]> = {
  CERTIFICATE_REQUEST: [
    {
      name: 'Student ID Card',
      type: 'STUDENT_ID',
      description: 'Official campus student ID card or government-issued photo identity proof.',
      required: true,
      stepOrder: 1,
    },
  ],
  SCHOLARSHIP_ASSISTANCE: [
    {
      name: 'Income Certificate / Marksheet',
      type: 'INCOME_PROOF',
      description: 'Official annual family income certificate or previous semester marksheet.',
      required: true,
      stepOrder: 1,
    },
  ],
  INTERNSHIP_DOCUMENTS: [
    {
      name: 'Offer Letter / Company Clearance',
      type: 'OFFER_LETTER',
      description: 'Formal company offer letter detailing designation, duration, and stipend terms.',
      required: true,
      stepOrder: 1,
    },
  ],
};

export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  // 1. Certificate Requests
  {
    id: 'wf-cert-request',
    key: 'CERTIFICATE_REQUEST',
    category: 'ACADEMIC_CERTIFICATE',
    title: 'Academic Certificate Request',
    description: 'Request official transcript, bona fide certificate, or degree copy.',
    departmentCode: 'REGISTRAR',
    pattern: 'DOCUMENT_VERIFICATION',
    requiredFields: [
      { key: 'certificateType', label: 'Certificate Type', type: 'select', required: true, description: 'Select the document type', options: ['Transcript', 'Bona Fide', 'Degree Copy', 'Course Completion'] },
      { key: 'purpose', label: 'Purpose of Request', type: 'textarea', required: true, description: 'State why you require this certificate' },
      { key: 'deliveryPreference', label: 'Delivery Preference', type: 'select', required: true, options: ['Digital PDF', 'Physical Copy Pickup', 'Speed Post'] }
    ],
    stepSequence: [
      { stepOrder: 1, name: 'Record & Document Verification', roleRequired: 'STAFF', description: 'Verify student academic records and eligibility', requiresDocuments: true },
      { stepOrder: 2, name: 'Registrar Signoff & Issuance', roleRequired: 'DEPARTMENT_ADMIN', description: 'Official seal approval and certificate issuance', requiresApproval: true }
    ]
  },

  // 2. Leave Requests
  {
    id: 'wf-leave-request',
    key: 'LEAVE_REQUEST',
    category: 'LEAVE_REQUEST',
    title: 'Leave Application',
    description: 'Apply for medical leave, duty leave, or emergency absence.',
    departmentCode: 'STUDENT_AFFAIRS',
    pattern: 'SIMPLE_APPROVAL',
    requiredFields: [
      { key: 'leaveType', label: 'Leave Type', type: 'select', required: true, options: ['Medical', 'Duty Leave', 'Emergency', 'Casual'] },
      { key: 'startDate', label: 'Start Date', type: 'date', required: true },
      { key: 'endDate', label: 'End Date', type: 'date', required: true },
      { key: 'reason', label: 'Reason for Leave', type: 'textarea', required: true }
    ],
    stepSequence: [
      { stepOrder: 1, name: 'HOD / Advisor Review', roleRequired: 'STAFF', description: 'Review leave eligibility and impact on attendance', requiresApproval: true }
    ]
  },

  // 3. Permission Requests
  {
    id: 'wf-permission-request',
    key: 'PERMISSION_REQUEST',
    category: 'PERMISSION_REQUEST',
    title: 'Special Campus Permission',
    description: 'Request out-of-time campus access, lab access, or equipment usage.',
    departmentCode: 'CAMPUS_OPS',
    pattern: 'SIMPLE_APPROVAL',
    requiredFields: [
      { key: 'permissionType', label: 'Permission Type', type: 'select', required: true, options: ['Late Night Lab Access', 'Special Equipment Usage', 'Campus Gate Exit Pass'] },
      { key: 'dateRequested', label: 'Date Requested', type: 'date', required: true },
      { key: 'justification', label: 'Justification', type: 'textarea', required: true }
    ],
    stepSequence: [
      { stepOrder: 1, name: 'Facility Manager Approval', roleRequired: 'DEPARTMENT_ADMIN', description: 'Verify safety and grant access pass', requiresApproval: true }
    ]
  },

  // 4. Campus Complaint Resolution
  {
    id: 'wf-campus-complaint',
    key: 'CAMPUS_COMPLAINT',
    category: 'CAMPUS_COMPLAINT',
    title: 'Campus Facility Complaint',
    description: 'Report maintenance, Wi-Fi, cleanliness, or infrastructure issues on campus.',
    departmentCode: 'CAMPUS_OPS',
    pattern: 'COMPLAINT_RESOLUTION',
    requiredFields: [
      { key: 'category', label: 'Complaint Category', type: 'select', required: true, options: ['Electrical', 'Plumbing', 'Wi-Fi/Network', 'HVAC', 'Cleanliness'] },
      { key: 'location', label: 'Location / Room Number', type: 'text', required: true },
      { key: 'priority', label: 'Priority Level', type: 'select', required: true, options: ['Low', 'Medium', 'High', 'Urgent'] },
      { key: 'description', label: 'Issue Description', type: 'textarea', required: true }
    ],
    stepSequence: [
      { stepOrder: 1, name: 'Desk Triage & Technician Assignment', roleRequired: 'STAFF', description: 'Triage work order and assign maintenance staff' },
      { stepOrder: 2, name: 'Resolution Verification Signoff', roleRequired: 'STAFF', description: 'Verify physical resolution and close ticket' }
    ]
  },

  // 5. Scholarship Assistance
  {
    id: 'wf-scholarship-assistance',
    key: 'SCHOLARSHIP_ASSISTANCE',
    category: 'SCHOLARSHIP_ASSISTANCE',
    title: 'Scholarship Assistance Application',
    description: 'Apply for merit scholarships, fee waivers, or financial aid endorsement.',
    departmentCode: 'FINANCIAL_AID',
    pattern: 'MULTI_LEVEL_APPROVAL',
    requiredFields: [
      { key: 'scholarshipType', label: 'Scholarship Scheme', type: 'text', required: true },
      { key: 'academicYear', label: 'Academic Year', type: 'text', required: true },
      { key: 'incomeDetails', label: 'Annual Family Income Details', type: 'textarea', required: true }
    ],
    stepSequence: [
      { stepOrder: 1, name: 'Financial Eligibility Audit', roleRequired: 'STAFF', description: 'Cross-check submitted documents and income criteria', requiresDocuments: true },
      { stepOrder: 2, name: 'Scholarship Board Approval', roleRequired: 'DEPARTMENT_ADMIN', description: 'Final committee signoff and fund allocation', requiresApproval: true }
    ]
  },

  // 6. Fees Assistance / Fee Issues
  {
    id: 'wf-fee-assistance',
    key: 'FEE_ASSISTANCE',
    category: 'FEE_ASSISTANCE',
    title: 'Fee Installment & Payment Issue',
    description: 'Request fee installment plan, fee receipt adjustment, or extension.',
    departmentCode: 'FINANCE',
    pattern: 'INFO_AND_ISSUE_RESOLUTION',
    requiredFields: [
      { key: 'issueType', label: 'Issue Type', type: 'select', required: true, options: ['Installment Request', 'Deadline Extension', 'Payment Discrepancy', 'Refund Inquiry'] },
      { key: 'amount', label: 'Amount Involved', type: 'number', required: true },
      { key: 'reason', label: 'Reason / Explanation', type: 'textarea', required: true }
    ],
    stepSequence: [
      { stepOrder: 1, name: 'Accounts Record Check', roleRequired: 'STAFF', description: 'Verify payment ledger and fee balance' },
      { stepOrder: 2, name: 'Finance Officer Sanction', roleRequired: 'DEPARTMENT_ADMIN', description: 'Sanction installment plan or adjustment', requiresApproval: true }
    ]
  },

  // 7. Academic Issues
  {
    id: 'wf-academic-issue',
    key: 'ACADEMIC_ISSUE',
    category: 'ACADEMIC_ISSUE',
    title: 'Academic Issue Escalation',
    description: 'Report grade discrepancies, course registration errors, or attendance updates.',
    departmentCode: 'ACADEMIC_AFFAIRS',
    pattern: 'INFO_AND_ISSUE_RESOLUTION',
    requiredFields: [
      { key: 'courseCode', label: 'Course Code & Name', type: 'text', required: true },
      { key: 'issueCategory', label: 'Issue Category', type: 'select', required: true, options: ['Grade Discrepancy', 'Attendance Updating', 'Registration Error', 'Exam Timetable Clash'] },
      { key: 'details', label: 'Detailed Explanation', type: 'textarea', required: true }
    ],
    stepSequence: [
      { stepOrder: 1, name: 'Faculty Review', roleRequired: 'FACULTY', description: 'Course instructor verification' },
      { stepOrder: 2, name: 'Academic Dean Resolution', roleRequired: 'DEPARTMENT_ADMIN', description: 'Official academic committee resolution', requiresApproval: true }
    ]
  },

  // 8. Event Permissions
  {
    id: 'wf-event-permission',
    key: 'EVENT_PERMISSION',
    category: 'EVENT_PERMISSION',
    title: 'Campus Event Approval',
    description: 'Request approval, venue booking, and security clearance for campus events.',
    departmentCode: 'STUDENT_AFFAIRS',
    pattern: 'MULTI_LEVEL_APPROVAL',
    requiredFields: [
      { key: 'eventName', label: 'Event Name', type: 'text', required: true },
      { key: 'eventDate', label: 'Event Date', type: 'date', required: true },
      { key: 'venue', label: 'Preferred Venue', type: 'select', required: true, options: ['Main Auditorium', 'Open Air Theatre', 'Seminar Hall A', 'Sports Ground'] },
      { key: 'expectedParticipants', label: 'Expected Participants', type: 'number', required: true },
      { key: 'description', label: 'Event Agenda & Description', type: 'textarea', required: true }
    ],
    stepSequence: [
      { stepOrder: 1, name: 'Safety & Facility Review', roleRequired: 'STAFF', description: 'Verify venue availability and safety rules' },
      { stepOrder: 2, name: 'Dean Student Affairs Authorization', roleRequired: 'DEPARTMENT_ADMIN', description: 'Final institutional permission grant', requiresApproval: true }
    ]
  },

  // 9. Club Permissions
  {
    id: 'wf-club-permission',
    key: 'CLUB_PERMISSION',
    category: 'CLUB_PERMISSION',
    title: 'Student Club Activity Authorization',
    description: 'Register a new club, request event budget, or authorize recruitment drives.',
    departmentCode: 'STUDENT_CLUBS',
    pattern: 'SIMPLE_APPROVAL',
    requiredFields: [
      { key: 'clubName', label: 'Club Name', type: 'text', required: true },
      { key: 'activityType', label: 'Activity Type', type: 'select', required: true, options: ['New Club Registration', 'Budget Request', 'Recruitment Drive', 'Workshop Authorization'] },
      { key: 'description', label: 'Activity Details', type: 'textarea', required: true }
    ],
    stepSequence: [
      { stepOrder: 1, name: 'Club Advisor Authorization', roleRequired: 'STAFF', description: 'Review club constitution and activity alignment', requiresApproval: true }
    ]
  },

  // 10. Hostel Requests
  {
    id: 'wf-hostel-request',
    key: 'HOSTEL_REQUEST',
    category: 'HOSTEL_REQUEST',
    title: 'Hostel Allotment & Maintenance',
    description: 'Apply for hostel room allocation, room change, or maintenance.',
    departmentCode: 'HOSTEL_ADMIN',
    pattern: 'MULTI_LEVEL_APPROVAL',
    requiredFields: [
      { key: 'requestType', label: 'Request Type', type: 'select', required: true, options: ['New Allotment', 'Room Change', 'Maintenance Request', 'Vacation Storage'] },
      { key: 'currentRoom', label: 'Current Room Number (if applicable)', type: 'text', required: false },
      { key: 'details', label: 'Preferences / Problem Details', type: 'textarea', required: true }
    ],
    stepSequence: [
      { stepOrder: 1, name: 'Hostel Warden Review', roleRequired: 'STAFF', description: 'Check occupancy and hostel rules compliance' },
      { stepOrder: 2, name: 'Chief Warden Approval', roleRequired: 'DEPARTMENT_ADMIN', description: 'Final room assignment authorization', requiresApproval: true }
    ]
  },

  // 11. Transport Requests
  {
    id: 'wf-transport-request',
    key: 'TRANSPORT_REQUEST',
    category: 'TRANSPORT_REQUEST',
    title: 'Campus Transport Services',
    description: 'Apply for bus pass, route change, or event shuttle booking.',
    departmentCode: 'TRANSPORT',
    pattern: 'SIMPLE_APPROVAL',
    requiredFields: [
      { key: 'serviceType', label: 'Service Type', type: 'select', required: true, options: ['Bus Pass Issuance', 'Route Change', 'Special Event Shuttle'] },
      { key: 'pickupPoint', label: 'Preferred Pickup Point', type: 'text', required: true }
    ],
    stepSequence: [
      { stepOrder: 1, name: 'Transport Officer Approval', roleRequired: 'STAFF', description: 'Verify route capacity and issue pass', requiresApproval: true }
    ]
  },

  // 12. Internship Requests / Documents
  {
    id: 'wf-internship-docs',
    key: 'INTERNSHIP_DOCUMENTS',
    category: 'INTERNSHIP_DOCUMENTS',
    title: 'NOC & Internship Clearance',
    description: 'Request No Objection Certificate (NOC) or internship document endorsement.',
    departmentCode: 'CAREER_CELL',
    pattern: 'DOCUMENT_VERIFICATION',
    requiredFields: [
      { key: 'companyName', label: 'Company / Organization Name', type: 'text', required: true },
      { key: 'role', label: 'Internship Role / Designation', type: 'text', required: true },
      { key: 'startDate', label: 'Start Date', type: 'date', required: true },
      { key: 'endDate', label: 'End Date', type: 'date', required: true },
      { key: 'offerLetter', label: 'Offer Letter Details / Reference', type: 'textarea', required: true }
    ],
    stepSequence: [
      { stepOrder: 1, name: 'Placement Officer Verification', roleRequired: 'STAFF', description: 'Verify offer authenticity and credit eligibility', requiresDocuments: true },
      { stepOrder: 2, name: 'Head Training & Placement Signoff', roleRequired: 'DEPARTMENT_ADMIN', description: 'Issue official NOC document', requiresApproval: true }
    ]
  },

  // 13. Lost & Found / Lost ID
  {
    id: 'wf-lost-found',
    key: 'LOST_AND_FOUND',
    category: 'LOST_AND_FOUND',
    title: 'Lost ID & Belongings Claim',
    description: 'Report a lost campus ID card or claim a found item.',
    departmentCode: 'CAMPUS_OPS',
    pattern: 'DOCUMENT_VERIFICATION',
    requiredFields: [
      { key: 'itemType', label: 'Item Type', type: 'select', required: true, options: ['Campus ID Card', 'Electronics', 'Personal Documents', 'Keys', 'Other'] },
      { key: 'dateLostFound', label: 'Date Lost / Found', type: 'date', required: true },
      { key: 'description', label: 'Detailed Description of Item', type: 'textarea', required: true }
    ],
    stepSequence: [
      { stepOrder: 1, name: 'Security Guard Verification', roleRequired: 'STAFF', description: 'Verify ownership details or issue replacement ID card work order' }
    ]
  }
];

export function getWorkflowByKey(key: string): WorkflowDefinition | undefined {
  return WORKFLOW_DEFINITIONS.find((wf) => wf.key === key);
}

export function listActiveWorkflows(): WorkflowDefinition[] {
  return WORKFLOW_DEFINITIONS;
}

/**
 * Authoritative Single Source of Truth for Workflow Requirements
 * Resolves required fields, required documents, approval rules, and responsible department.
 */
export function getWorkflowRequirements(
  workflowKey: string,
  currentStepOrder?: number
): WorkflowRequirements | null {
  const wf = getWorkflowByKey(workflowKey);
  if (!wf) return null;

  const departmentName = DEPARTMENT_NAMES[wf.departmentCode] || wf.departmentCode;

  // Resolve document requirements
  const explicitDocs = WORKFLOW_DOCUMENT_SPECS[wf.key] || [];
  const requiredDocuments: DocumentRequirement[] = [...explicitDocs];

  // If a step has requiresDocuments: true but wasn't in explicit map, add standard requirement
  for (const step of wf.stepSequence) {
    if (step.requiresDocuments && !requiredDocuments.some((d) => d.stepOrder === step.stepOrder)) {
      requiredDocuments.push({
        name: 'Supporting Verification Document',
        type: 'GENERAL',
        description: `Required verification document for Step ${step.stepOrder} (${step.name}).`,
        required: true,
        stepOrder: step.stepOrder,
      });
    }
  }

  // Resolve approval requirements
  const requiredApprovals = wf.stepSequence
    .filter((s) => s.requiresApproval)
    .map((s) => ({
      stepOrder: s.stepOrder,
      name: s.name,
      roleRequired: s.roleRequired,
      description: s.description,
    }));

  const activeStep = currentStepOrder
    ? wf.stepSequence.find((s) => s.stepOrder === currentStepOrder) || wf.stepSequence[0]
    : wf.stepSequence[0];

  let submissionNotice: string | undefined = undefined;
  if (requiredDocuments.length > 0) {
    const docNames = requiredDocuments.map((d) => d.name).join(', ');
    submissionNotice = `Your request can be submitted, but staff cannot process Step 1 until the following required document is uploaded: ${docNames}.`;
  }

  return {
    workflowKey: wf.key,
    workflowTitle: wf.title,
    category: wf.category,
    departmentCode: wf.departmentCode,
    departmentName,
    pattern: wf.pattern,
    responsibleRole: activeStep?.roleRequired || 'STAFF',
    currentStepOrder: activeStep?.stepOrder,
    currentStepName: activeStep?.name,
    requiredFields: wf.requiredFields,
    requiredDocuments,
    requiredApprovals,
    steps: wf.stepSequence.map((s) => ({
      stepOrder: s.stepOrder,
      name: s.name,
      roleRequired: s.roleRequired,
      description: s.description,
      requiresDocuments: s.requiresDocuments || false,
      requiresApproval: s.requiresApproval || false,
    })),
    submissionNotice,
  };
}

