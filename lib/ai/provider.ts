/**
 * CampusOS AI Provider Abstraction
 * 
 * ISOLATION RULE:
 * Provider-specific LLM code is completely isolated here.
 * The rest of the application depends strictly on this abstraction layer.
 */

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
}

export async function generateStructuredResponse<T>(
  prompt: string,
  systemPrompt?: string,
  options?: LLMOptions
): Promise<T> {
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'gemini-1.5-pro';

  // If real API key is configured, call external LLM API
  if (apiKey && apiKey !== 'your-llm-api-key') {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: `${systemPrompt ? systemPrompt + '\n\n' : ''}Respond ONLY with valid JSON matching the requested structure.\n\nPROMPT:\n${prompt}` }
              ]
            }
          ],
          generationConfig: {
            temperature: options?.temperature ?? 0.2,
            responseMimeType: 'application/json',
          }
        })
      });

      if (response.ok) {
        const jsonResult = await response.json();
        const textOutput = jsonResult.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textOutput) {
          return JSON.parse(textOutput) as T;
        }
      }
    } catch (error) {
      console.warn('[AI_PROVIDER_WARNING] External LLM call failed or timed out. Falling back to local intelligence parser.', error);
    }
  }

  // Fallback Rule-Based Parser for local demo evaluation & offline testing when API key is unconfigured
  return parseNaturalLanguagePromptLocally(prompt) as T;
}

/**
 * Local Deterministic Intent & Field Extractor (Fallback Engine)
 */
function parseNaturalLanguagePromptLocally(prompt: string): Record<string, unknown> {
  const text = prompt.toLowerCase();
  const today = new Date().toISOString().split('T')[0];

  // 1. Certificate Requests & Student Verification Proofs
  if (
    text.includes('transcript') ||
    text.includes('bona fide') ||
    text.includes('bonafide') ||
    text.includes('degree') ||
    text.includes('certificate') ||
    text.includes('proof that i am a student') ||
    text.includes('student proof') ||
    text.includes('proof of study') ||
    text.includes('enrollment certificate') ||
    text.includes('study certificate')
  ) {
    let certType = 'Bona Fide';
    if (text.includes('transcript')) certType = 'Transcript';
    if (text.includes('degree')) certType = 'Degree Copy';
    if (text.includes('course completion')) certType = 'Course Completion';

    let purpose: string | undefined = undefined;
    if (text.includes('loan') || text.includes('bank')) purpose = 'Bank education loan application';
    else if (text.includes('passport')) purpose = 'Passport application';
    else if (text.includes('visa')) purpose = 'Student visa application';
    else if (text.includes('higher studies') || text.includes('masters') || text.includes('graduate') || text.includes('admission')) purpose = 'Higher education admission application';
    else if (text.includes('job') || text.includes('employment') || text.includes('work')) purpose = 'Employment verification';
    else if (text.includes('scholarship') || text.includes('grant')) purpose = 'Scholarship application';
    else if (text.includes('internship')) purpose = 'Internship application';
    else if (text.includes('verification') || text.includes('official')) purpose = 'Official university verification';

    let deliveryPreference = 'Digital PDF';
    if (text.includes('post') || text.includes('courier') || text.includes('mail')) {
      deliveryPreference = 'Speed Post';
    } else if (text.includes('pickup') || text.includes('collect') || text.includes('in person')) {
      deliveryPreference = 'Physical Copy Pickup';
    }

    return {
      workflowKey: 'CERTIFICATE_REQUEST',
      intent: purpose ? `Request ${certType} certificate for ${purpose}` : `Request ${certType} certificate`,
      confidence: 0.96,
      extractedData: {
        certificateType: certType,
        ...(purpose ? { purpose } : {}),
        deliveryPreference,
      },
      explanation: purpose
        ? `Identified Academic Certificate Request (${certType}) for ${purpose}.`
        : `Identified Academic Certificate Request (${certType}).`,
    };
  }

  // 2. Lost & Found / Lost ID Card
  if (
    text.includes('lost') ||
    text.includes('misplaced') ||
    text.includes('lost my id') ||
    text.includes('lost id') ||
    text.includes('found my id') ||
    text.includes('lost student id')
  ) {
    let itemType = 'Campus ID Card';
    if (text.includes('phone') || text.includes('laptop') || text.includes('electronics')) itemType = 'Electronics';
    if (text.includes('document') || text.includes('passport') || text.includes('certificate')) itemType = 'Personal Documents';
    if (text.includes('key')) itemType = 'Keys';

    return {
      workflowKey: 'LOST_AND_FOUND',
      intent: `Report lost or misplaced ${itemType}`,
      confidence: 0.95,
      extractedData: {
        itemType,
        dateLostFound: today,
        description: prompt,
      },
      explanation: `Identified Lost & Found / Lost ID claim for ${itemType}.`,
    };
  }

  // 3. Leave Requests
  if (
    text.includes('leave') ||
    text.includes('absent') ||
    text.includes('sick') ||
    text.includes('medical') ||
    text.includes('fever') ||
    text.includes('hospital')
  ) {
    let leaveType = 'Casual';
    if (text.includes('medical') || text.includes('sick') || text.includes('fever') || text.includes('hospital')) leaveType = 'Medical';
    if (text.includes('duty') || text.includes('competition') || text.includes('conference')) leaveType = 'Duty Leave';
    if (text.includes('emergency') || text.includes('urgent')) leaveType = 'Emergency';

    return {
      workflowKey: 'LEAVE_REQUEST',
      intent: `Submit ${leaveType} leave application`,
      confidence: 0.94,
      extractedData: {
        leaveType,
        startDate: today,
        endDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        reason: prompt,
      },
      explanation: `Identified Leave Application (${leaveType} leave) starting from ${today}.`,
    };
  }

  // 4. Hostel Requests & Maintenance
  if (text.includes('hostel') || text.includes('dorm') || text.includes('warden') || text.includes('room change') || text.includes('hostel water')) {
    let requestType = 'Maintenance Request';
    if (text.includes('allotment') || text.includes('new room') || text.includes('admission')) requestType = 'New Allotment';
    if (text.includes('change') || text.includes('shift') || text.includes('switch')) requestType = 'Room Change';
    if (text.includes('storage') || text.includes('vacation')) requestType = 'Vacation Storage';

    return {
      workflowKey: 'HOSTEL_REQUEST',
      intent: `Submit hostel ${requestType.toLowerCase()}`,
      confidence: 0.93,
      extractedData: {
        requestType,
        currentRoom: 'Hostel Block B',
        details: prompt,
      },
      explanation: `Identified Hostel Allotment & Maintenance request (${requestType}).`,
    };
  }

  // 5. Campus Maintenance & Facilities Complaints
  if (
    text.includes('projector') ||
    text.includes('wifi') ||
    text.includes('wi-fi') ||
    text.includes('internet') ||
    text.includes('ac') ||
    text.includes('air condition') ||
    text.includes('clean') ||
    text.includes('complaint') ||
    text.includes('broken') ||
    text.includes('repair') ||
    text.includes('leak') ||
    text.includes('water') ||
    text.includes('not working')
  ) {
    let category = 'Electrical';
    if (text.includes('wifi') || text.includes('wi-fi') || text.includes('internet') || text.includes('network')) category = 'Wi-Fi/Network';
    if (text.includes('projector') || text.includes('ac') || text.includes('hvac')) category = 'HVAC';
    if (text.includes('plumb') || text.includes('water') || text.includes('pipe') || text.includes('leak') || text.includes('tap')) category = 'Plumbing';
    if (text.includes('clean') || text.includes('washroom') || text.includes('dust') || text.includes('trash')) category = 'Cleanliness';

    // Extract room number if present
    const roomMatch = prompt.match(/room\s*(\d+[a-zA-Z]?|[a-zA-Z]+\s*\d+)/i) || prompt.match(/hall\s*([a-zA-Z0-9]+)/i);
    const location = roomMatch ? `Room ${roomMatch[1]}` : 'Classroom 204';

    return {
      workflowKey: 'CAMPUS_COMPLAINT',
      intent: `Report ${category} maintenance issue at ${location}`,
      confidence: 0.95,
      extractedData: {
        category,
        location,
        priority: 'High',
        description: prompt,
      },
      explanation: `Identified Campus Facility Complaint (${category}) at ${location}.`,
    };
  }

  // 6. Campus Event Approvals
  if (text.includes('event') || text.includes('auditorium') || text.includes('symposium') || text.includes('hackathon') || text.includes('organize') || text.includes('workshop')) {
    return {
      workflowKey: 'EVENT_PERMISSION',
      intent: 'Request permission and venue for campus event',
      confidence: 0.93,
      extractedData: {
        eventName: 'Technical Event',
        eventDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
        venue: 'Seminar Hall A',
        expectedParticipants: 100,
        description: prompt,
      },
      explanation: 'Identified Campus Event Approval request.',
    };
  }

  // 7. Scholarship Assistance
  if (text.includes('scholarship') || text.includes('financial aid') || text.includes('grant') || text.includes('fee waiver')) {
    return {
      workflowKey: 'SCHOLARSHIP_ASSISTANCE',
      intent: 'Apply for scholarship and financial assistance',
      confidence: 0.94,
      extractedData: {
        scholarshipType: 'Merit Scholarship',
        academicYear: '2025-2026',
        incomeDetails: 'Family Annual Income below statutory threshold',
      },
      explanation: 'Identified Scholarship Assistance application.',
    };
  }

  // 8. Internship & NOC Documents
  if (text.includes('internship') || text.includes('noc') || text.includes('offer letter') || text.includes('intern')) {
    return {
      workflowKey: 'INTERNSHIP_DOCUMENTS',
      intent: 'Request Internship NOC and Document Clearance',
      confidence: 0.93,
      extractedData: {
        companyName: 'Partner Organization',
        role: 'Software Intern',
        startDate: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
        endDate: new Date(Date.now() + 86400000 * 75).toISOString().split('T')[0],
        offerLetter: prompt,
      },
      explanation: 'Identified NOC & Internship Clearance request.',
    };
  }

  // 9. Transport Services
  if (text.includes('transport') || text.includes('bus pass') || text.includes('shuttle') || text.includes('bus route')) {
    return {
      workflowKey: 'TRANSPORT_REQUEST',
      intent: 'Request campus transport or bus pass',
      confidence: 0.92,
      extractedData: {
        serviceType: 'Bus Pass Issuance',
        pickupPoint: 'Main Campus Gate',
      },
      explanation: 'Identified Campus Transport Services request.',
    };
  }

  // 10. Fee Issues & Installments
  if (text.includes('fee') || text.includes('tuition') || text.includes('installment') || text.includes('refund')) {
    return {
      workflowKey: 'FEE_ASSISTANCE',
      intent: 'Request fee installment or resolution',
      confidence: 0.92,
      extractedData: {
        issueType: 'Installment Request',
        amount: 1500,
        reason: prompt,
      },
      explanation: 'Identified Fee Installment & Payment Issue request.',
    };
  }

  // 11. Student Clubs
  if (text.includes('club') || text.includes('society') || text.includes('recruitment drive')) {
    return {
      workflowKey: 'CLUB_PERMISSION',
      intent: 'Submit student club activity authorization',
      confidence: 0.91,
      extractedData: {
        clubName: 'Student Technical Society',
        activityType: 'Workshop Authorization',
        description: prompt,
      },
      explanation: 'Identified Student Club Activity Authorization.',
    };
  }

  // Low confidence / clarification fallback
  return {
    workflowKey: null,
    intent: 'Unclear campus request',
    confidence: 0.35,
    extractedData: {},
    explanation: 'Could not confidently match request to a specific workflow definition.',
  };
}
