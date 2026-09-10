export type UserRole =
  | 'STUDENT'
  | 'FACULTY'
  | 'STAFF'
  | 'DEPARTMENT_ADMIN'
  | 'UNIVERSITY_ADMIN';

export type WorkflowCategory =
  | 'ACADEMIC_CERTIFICATE'
  | 'ACADEMIC_ISSUE'
  | 'LEAVE_REQUEST'
  | 'PERMISSION_REQUEST'
  | 'CAMPUS_COMPLAINT'
  | 'HOSTEL_REQUEST'
  | 'TRANSPORT_REQUEST'
  | 'LOST_AND_FOUND'
  | 'SCHOLARSHIP_ASSISTANCE'
  | 'FEE_ASSISTANCE'
  | 'EVENT_PERMISSION'
  | 'CLUB_PERMISSION'
  | 'INTERNSHIP_DOCUMENTS';

export type WorkflowPattern =
  | 'SIMPLE_APPROVAL'
  | 'MULTI_LEVEL_APPROVAL'
  | 'COMPLAINT_RESOLUTION'
  | 'DOCUMENT_VERIFICATION'
  | 'INFO_AND_ISSUE_RESOLUTION';

export type RequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'AI_PROCESSING'
  | 'INFORMATION_REQUIRED'
  | 'VALIDATING'
  | 'ROUTED'
  | 'ASSIGNED'
  | 'UNDER_REVIEW'
  | 'APPROVAL_PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'COMPLETED'
  | 'CANCELLED';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'boolean' | 'select';

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  description?: string;
  options?: string[];
}

export interface StepDefinition {
  stepOrder: number;
  name: string;
  roleRequired: UserRole;
  description: string;
  requiresApproval?: boolean;
  requiresDocuments?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  key: string;
  title: string;
  category: WorkflowCategory;
  description: string;
  departmentCode: string;
  pattern: WorkflowPattern;
  requiredFields: FieldDefinition[];
  stepSequence: StepDefinition[];
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId?: string | null;
  departmentCode?: string | null;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface CreateRequestInput {
  requesterId: string;
  workflowKey: string;
  title?: string;
  summary?: string;
  data: Record<string, unknown>;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  actorName?: string;
  actorRole?: string;
  type: 'STATUS_CHANGE' | 'TASK' | 'APPROVAL' | 'AUDIT' | 'DOCUMENT';
  metadata?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
