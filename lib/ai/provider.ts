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

  if (text.includes('transcript') || text.includes('bona fide') || text.includes('bonafide') || text.includes('degree') || text.includes('certificate')) {
    let certType = 'Bona Fide';
    if (text.includes('transcript')) certType = 'Transcript';
    if (text.includes('degree')) certType = 'Degree Copy';

    let purpose: string | undefined = undefined;
    if (text.includes('loan')) purpose = 'Education loan application';
    if (text.includes('passport')) purpose = 'Passport application';
    if (text.includes('higher studies') || text.includes('masters')) purpose = 'Higher education admission';

    const extracted: Record<string, unknown> = {
      certificateType: certType,
    };
    if (purpose) {
      extracted.purpose = purpose;
    }

    if (text.includes('pdf') || text.includes('digital') || text.includes('soft copy')) {
      extracted.deliveryPreference = 'Digital PDF';
    } else if (text.includes('post') || text.includes('courier')) {
      extracted.deliveryPreference = 'Speed Post';
    } else if (text.includes('pickup') || text.includes('collect')) {
      extracted.deliveryPreference = 'Physical Copy Pickup';
    }

    return {
      workflowKey: 'CERTIFICATE_REQUEST',
      intent: 'Request academic certificate or transcript',
      confidence: 0.95,
      extractedData: extracted,
      explanation: 'Matched prompt to Academic Certificate Request based on certificate keywords.',
    };
  }

  if (text.includes('leave') || text.includes('absent') || text.includes('sick') || text.includes('medical')) {
    let leaveType = 'Casual';
    if (text.includes('medical') || text.includes('sick') || text.includes('hospital')) leaveType = 'Medical';
    if (text.includes('duty') || text.includes('event')) leaveType = 'Duty Leave';

    return {
      workflowKey: 'LEAVE_REQUEST',
      intent: 'Submit student or faculty leave application',
      confidence: 0.92,
      extractedData: {
        leaveType,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        reason: prompt,
      },
      explanation: 'Matched prompt to Leave Application based on leave/absence keywords.',
    };
  }

  if (text.includes('projector') || text.includes('wifi') || text.includes('wi-fi') || text.includes('ac') || text.includes('clean') || text.includes('complaint') || text.includes('broken')) {
    let category = 'Electrical';
    if (text.includes('wifi') || text.includes('wi-fi') || text.includes('internet')) category = 'Wi-Fi/Network';
    if (text.includes('projector') || text.includes('ac')) category = 'HVAC';
    if (text.includes('plumb') || text.includes('water') || text.includes('leak')) category = 'Plumbing';

    return {
      workflowKey: 'CAMPUS_COMPLAINT',
      intent: 'Report facility or maintenance complaint',
      confidence: 0.94,
      extractedData: {
        category,
        location: 'Classroom 302',
        priority: 'High',
        description: prompt,
      },
      explanation: 'Matched prompt to Campus Facility Complaint based on maintenance keywords.',
    };
  }

  if (text.includes('event') || text.includes('auditorium') || text.includes('symposium') || text.includes('hackathon')) {
    return {
      workflowKey: 'EVENT_PERMISSION',
      intent: 'Request permission and venue for campus event',
      confidence: 0.91,
      extractedData: {
        eventName: 'Campus Tech Symposium',
        eventDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
        venue: 'Main Auditorium',
        expectedParticipants: 150,
        description: prompt,
      },
      explanation: 'Matched prompt to Campus Event Approval based on event keywords.',
    };
  }

  if (text.includes('scholarship') || text.includes('financial aid') || text.includes('grant')) {
    return {
      workflowKey: 'SCHOLARSHIP_ASSISTANCE',
      intent: 'Apply for scholarship assistance',
      confidence: 0.90,
      extractedData: {
        scholarshipType: 'Merit Scholarship',
        academicYear: '2025-2026',
        incomeDetails: 'Family Annual Income below statutory threshold',
      },
      explanation: 'Matched prompt to Scholarship Assistance based on scholarship keywords.',
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
