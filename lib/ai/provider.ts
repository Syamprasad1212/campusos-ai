/**
 * CampusOS AI Provider Abstraction
 * 
 * ISOLATION RULE:
 * Provider-specific LLM code is completely isolated here.
 * The rest of the application depends strictly on this abstraction layer.
 */

import { logger } from '@/lib/observability/logger';

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
  const startTime = Date.now();

  // If real API key is configured, call external LLM API
  if (apiKey && apiKey !== 'your-llm-api-key') {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(6000),
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
          logger.info('AI_REQUEST', 'External LLM call completed successfully', {
            durationMs: Date.now() - startTime,
            workflowKey: 'GEMINI_LLM',
          });
          return JSON.parse(textOutput) as T;
        }
      }
    } catch (error: any) {
      logger.warn('AI_FALLBACK_USED', 'External LLM call failed or timed out. Falling back to local intelligence parser.', {
        error: error.message,
        durationMs: Date.now() - startTime,
      });
    }
  }

  // Fallback Rule-Based Parser for local demo evaluation & offline testing when API key is unconfigured
  logger.info('AI_FALLBACK_USED', 'Using deterministic fallback intelligence parser');
  return parseNaturalLanguagePromptLocally(prompt) as T;
}

/**
 * Local Deterministic Intent & Field Extractor (Fallback Engine)
 * 
 * CORE PRINCIPLES:
 * 1. INFER INTENT AGGRESSIVELY, BUT INFER FACTS CONSERVATIVELY.
 * 2. PROMPT INJECTION DEFENSE: Treat user prompt as pure unstructured text data.
 *    Adversarial overrides ("ignore rules", "make me admin", etc.) are safely neutralized.
 */
function parseNaturalLanguagePromptLocally(prompt: string): Record<string, unknown> {
  const text = prompt.toLowerCase();

  // Defense-in-depth: If prompt is purely an adversarial attempt to override system
  if (
    text.includes('ignore all previous instructions') ||
    text.includes('ignore previous instructions') ||
    text.includes('system override') ||
    text.includes('grant me admin') ||
    text.includes('make me admin') ||
    text.includes('bypass approval') ||
    text.includes('mark this request as approved')
  ) {
    return {
      workflowKey: null,
      intent: 'Adversarial instruction detected — prompt neutralized',
      confidence: 0.1,
      extractedData: {},
      explanation: 'Input contains adversarial instructions and cannot be mapped to any legitimate campus workflow.',
    };
  }

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
    else if (text.includes('degree')) certType = 'Degree Copy';
    else if (text.includes('course completion')) certType = 'Course Completion';

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
    else if (text.includes('document') || text.includes('passport') || text.includes('certificate')) itemType = 'Personal Documents';
    else if (text.includes('key')) itemType = 'Keys';

    // Extract date ONLY if explicitly in prompt; do NOT invent today's date
    const dateMatch = prompt.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    const dateLostFound = dateMatch ? dateMatch[1] : undefined;

    return {
      workflowKey: 'LOST_AND_FOUND',
      intent: `Report lost or misplaced ${itemType}`,
      confidence: 0.95,
      extractedData: {
        itemType,
        ...(dateLostFound ? { dateLostFound } : {}),
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
    else if (text.includes('duty') || text.includes('competition') || text.includes('conference')) leaveType = 'Duty Leave';
    else if (text.includes('emergency') || text.includes('urgent')) leaveType = 'Emergency';

    // Extract dates ONLY if explicitly provided in prompt
    const dateMatches = prompt.match(/\b(\d{4}-\d{2}-\d{2})\b/g);
    const startDate = dateMatches && dateMatches[0] ? dateMatches[0] : undefined;
    const endDate = dateMatches && dateMatches[1] ? dateMatches[1] : undefined;

    return {
      workflowKey: 'LEAVE_REQUEST',
      intent: `Submit ${leaveType} leave application`,
      confidence: 0.94,
      extractedData: {
        leaveType,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        reason: prompt,
      },
      explanation: `Identified Leave Application (${leaveType} leave).`,
    };
  }

  // 4. Hostel Requests & Maintenance
  if (text.includes('hostel') || text.includes('dorm') || text.includes('warden') || text.includes('room change') || text.includes('hostel water')) {
    let requestType = 'Maintenance Request';
    if (text.includes('allotment') || text.includes('new room') || text.includes('admission')) requestType = 'New Allotment';
    else if (text.includes('change') || text.includes('shift') || text.includes('switch')) requestType = 'Room Change';
    else if (text.includes('storage') || text.includes('vacation')) requestType = 'Vacation Storage';

    // Extract room number if stated, otherwise keep optional currentRoom omitted
    const roomMatch = prompt.match(/room\s*(\d+[a-zA-Z]?|[a-zA-Z]+\s*\d+)/i) || prompt.match(/block\s*([a-zA-Z0-9]+)/i);
    const currentRoom = roomMatch ? `Room ${roomMatch[1]}` : undefined;

    return {
      workflowKey: 'HOSTEL_REQUEST',
      intent: `Submit hostel ${requestType.toLowerCase()}`,
      confidence: 0.93,
      extractedData: {
        requestType,
        ...(currentRoom ? { currentRoom } : {}),
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
    text.includes('not working') ||
    text.includes('plumbing') ||
    text.includes('electrical')
  ) {
    let category: string | undefined = undefined;
    if (text.includes('wifi') || text.includes('wi-fi') || text.includes('internet') || text.includes('network')) category = 'Wi-Fi/Network';
    else if (text.includes('ac') || text.includes('air condition') || text.includes('hvac') || text.includes('cooling') || text.includes('heater')) category = 'HVAC';
    else if (text.includes('plumb') || text.includes('water') || text.includes('pipe') || text.includes('leak') || text.includes('tap')) category = 'Plumbing';
    else if (text.includes('clean') || text.includes('washroom') || text.includes('dust') || text.includes('trash') || text.includes('garbage')) category = 'Cleanliness';
    else if (text.includes('projector') || text.includes('electrical') || text.includes('power') || text.includes('light') || text.includes('socket') || text.includes('switch') || text.includes('wire')) category = 'Electrical';

    // Extract room/location ONLY if present in prompt
    const roomMatch = prompt.match(/room\s*(\d+[a-zA-Z]?|[a-zA-Z]+\s*\d+)/i) || prompt.match(/hall\s*([a-zA-Z0-9]+)/i) || prompt.match(/lab\s*([a-zA-Z0-9]+)/i);
    const location = roomMatch ? `Room ${roomMatch[1]}` : undefined;

    return {
      workflowKey: 'CAMPUS_COMPLAINT',
      intent: `Report maintenance issue${location ? ` at ${location}` : ''}`,
      confidence: 0.95,
      extractedData: {
        ...(category ? { category } : {}),
        ...(location ? { location } : {}),
        priority: text.includes('urgent') || text.includes('emergency') || text.includes('immediately') ? 'High' : 'Medium',
        description: prompt,
      },
      explanation: `Identified Campus Facility Complaint${category ? ` (${category})` : ''}${location ? ` at ${location}` : ''}.`,
    };
  }

  // 6. Campus Event Approvals
  if (text.includes('event') || text.includes('auditorium') || text.includes('symposium') || text.includes('hackathon') || text.includes('organize') || text.includes('workshop')) {
    let eventName = 'Technical Event';
    if (text.includes('hackathon')) eventName = 'Campus Hackathon';
    else if (text.includes('symposium')) eventName = 'Technical Symposium';
    else if (text.includes('workshop')) eventName = 'Technical Workshop';
    else if (text.includes('seminar')) eventName = 'Academic Seminar';

    // Extract date ONLY if present
    const dateMatch = prompt.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    const eventDate = dateMatch ? dateMatch[1] : undefined;

    // Extract venue ONLY if explicitly stated in prompt
    let venue: string | undefined = undefined;
    if (text.includes('auditorium')) venue = 'Main Auditorium';
    else if (text.includes('open air') || text.includes('theatre')) venue = 'Open Air Theatre';
    else if (text.includes('seminar hall')) venue = 'Seminar Hall A';
    else if (text.includes('sports ground') || text.includes('ground')) venue = 'Sports Ground';

    // Extract participant count ONLY if explicitly stated in prompt
    const participantMatch = prompt.match(/(\d+)\s*(people|students|participants|attendees)/i);
    const expectedParticipants = participantMatch ? parseInt(participantMatch[1], 10) : undefined;

    return {
      workflowKey: 'EVENT_PERMISSION',
      intent: 'Request permission and venue for campus event',
      confidence: 0.93,
      extractedData: {
        eventName,
        ...(eventDate ? { eventDate } : {}),
        ...(venue ? { venue } : {}),
        ...(expectedParticipants ? { expectedParticipants } : {}),
        description: prompt,
      },
      explanation: 'Identified Campus Event Approval request.',
    };
  }

  // 7. Scholarship Assistance
  if (text.includes('scholarship') || text.includes('financial aid') || text.includes('grant') || text.includes('fee waiver')) {
    // Extract scholarship scheme ONLY if explicitly mentioned
    let scholarshipType: string | undefined = undefined;
    if (text.includes('merit')) scholarshipType = 'Merit Scholarship';
    else if (text.includes('need-based') || text.includes('need based')) scholarshipType = 'Need-Based Financial Aid';
    else if (text.includes('sports')) scholarshipType = 'Sports Scholarship';

    // Extract academic year ONLY if mentioned
    const yearMatch = prompt.match(/\b(20\d{2}-20\d{2}|20\d{2})\b/);
    const academicYear = yearMatch ? yearMatch[1] : undefined;

    // Extract income details ONLY if mentioned
    const incomeMatch = prompt.match(/income\s*(?:of|is|below|under)?\s*([0-9,]+)/i);
    const incomeDetails = incomeMatch ? `Annual income ${incomeMatch[1]}` : undefined;

    return {
      workflowKey: 'SCHOLARSHIP_ASSISTANCE',
      intent: 'Apply for scholarship and financial assistance',
      confidence: 0.94,
      extractedData: {
        ...(scholarshipType ? { scholarshipType } : {}),
        ...(academicYear ? { academicYear } : {}),
        ...(incomeDetails ? { incomeDetails } : {}),
      },
      explanation: 'Identified Scholarship Assistance application.',
    };
  }

  // 8. Internship & NOC Documents
  if (text.includes('internship') || text.includes('noc') || text.includes('offer letter') || text.includes('intern')) {
    const dateMatches = prompt.match(/\b(\d{4}-\d{2}-\d{2})\b/g);
    const startDate = dateMatches && dateMatches[0] ? dateMatches[0] : undefined;
    const endDate = dateMatches && dateMatches[1] ? dateMatches[1] : undefined;

    return {
      workflowKey: 'INTERNSHIP_DOCUMENTS',
      intent: 'Request Internship NOC and Document Clearance',
      confidence: 0.93,
      extractedData: {
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        offerLetter: prompt,
      },
      explanation: 'Identified NOC & Internship Clearance request.',
    };
  }

  // 9. Transport Services
  if (text.includes('transport') || text.includes('bus pass') || text.includes('shuttle') || text.includes('bus route')) {
    let serviceType = 'Bus Pass Issuance';
    if (text.includes('route change')) serviceType = 'Route Change';
    else if (text.includes('shuttle')) serviceType = 'Special Event Shuttle';

    const pickupMatch = prompt.match(/from\s+([a-zA-Z0-9\s]+?)(?:\s+to|\.|$)/i);
    const pickupPoint = pickupMatch ? pickupMatch[1].trim() : undefined;

    return {
      workflowKey: 'TRANSPORT_REQUEST',
      intent: 'Request campus transport or bus pass',
      confidence: 0.92,
      extractedData: {
        serviceType,
        ...(pickupPoint ? { pickupPoint } : {}),
      },
      explanation: 'Identified Campus Transport Services request.',
    };
  }

  // 10. Fee Issues & Installments
  if (text.includes('fee') || text.includes('tuition') || text.includes('installment') || text.includes('refund')) {
    let issueType = 'Installment Request';
    if (text.includes('extension') || text.includes('deadline')) issueType = 'Deadline Extension';
    else if (text.includes('discrepancy')) issueType = 'Payment Discrepancy';
    else if (text.includes('refund')) issueType = 'Refund Inquiry';

    const amountMatch = prompt.match(/(?:amount|rs\.?|\$|inr)\s*([0-9,]+)/i) || prompt.match(/([0-9,]+)\s*(?:rupees|dollars|inr)/i);
    const amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : undefined;

    return {
      workflowKey: 'FEE_ASSISTANCE',
      intent: 'Request fee installment or resolution',
      confidence: 0.92,
      extractedData: {
        issueType,
        ...(amount !== undefined ? { amount } : {}),
        reason: prompt,
      },
      explanation: 'Identified Fee Installment & Payment Issue request.',
    };
  }

  // 11. Student Clubs
  if (text.includes('club') || text.includes('society') || text.includes('recruitment drive')) {
    let activityType = 'Workshop Authorization';
    if (text.includes('new club') || text.includes('register')) activityType = 'New Club Registration';
    else if (text.includes('budget')) activityType = 'Budget Request';
    else if (text.includes('recruitment')) activityType = 'Recruitment Drive';

    const clubMatch = prompt.match(/club\s+([a-zA-Z0-9\s]+?)(?:\s+for|\.|$)/i) || prompt.match(/([a-zA-Z0-9\s]+)\s+club/i);
    const clubName = clubMatch ? clubMatch[1].trim() : undefined;

    return {
      workflowKey: 'CLUB_PERMISSION',
      intent: 'Submit student club activity authorization',
      confidence: 0.91,
      extractedData: {
        ...(clubName ? { clubName } : {}),
        activityType,
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
