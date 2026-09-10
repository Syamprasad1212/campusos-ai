/**
 * CampusOS AI Service Stub Layer
 * 
 * ARCHITECTURAL PRINCIPLES ENFORCED:
 * 1. AI services do NOT directly mutate the database.
 * 2. AI output is strictly read-only suggestions that must be validated by schemas.
 * 3. Human staff/approval is required before any database state mutation occurs.
 */

export interface IntentClassificationResult {
  suggestedCategory: string;
  confidenceScore: number;
  extractedFields: Record<string, string>;
  missingFields: string[];
  explanation: string;
}

export async function classifyStudentRequestIntent(
  naturalLanguagePrompt: string
): Promise<IntentClassificationResult> {
  // Stub function prepared for future LLM API integration.
  // In later stages, this will invoke the structured output LLM API.
  return {
    suggestedCategory: 'CAMPUS_COMPLAINT',
    confidenceScore: 0.92,
    extractedFields: {
      location: 'Library 2nd Floor',
    },
    missingFields: ['description'],
    explanation: `Extracted intent from prompt: "${naturalLanguagePrompt}"`,
  };
}
