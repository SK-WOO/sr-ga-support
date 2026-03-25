// SR GA Support — Core Type Definitions

export type StatusType = "pending" | "in_progress" | "approved" | "rejected" | "completed" | "cancelled";
export type RequestCategory = "general" | "travel" | "breakdown" | "rental";
export type ApprovalRole = "manager" | "ceo" | "assignee";

export type RequestType =
  | "business_card" | "onboarding_item" | "onboarding_account"
  | "offboarding_item" | "offboarding_account" | "corporate_card"
  | "domestic_trip" | "overseas_trip"
  | "asset_breakdown" | "facility_breakdown" | "it_breakdown" | "item_breakdown"
  | "car_rental" | "rnd_item" | "equipment_rental";

export interface Attachment {
  url: string;
  name: string;
}

export interface ApprovalHistoryEntry {
  step: number;
  role: ApprovalRole;
  approverEmail: string;
  decision: "approved" | "rejected";
  comment: string;
  ts: string;
}

export interface Request {
  id: string;
  type: RequestType;
  category: RequestCategory;
  title: string;
  applicantEmail: string;
  applicantId: string;
  submittedBy?: string;
  status: StatusType;
  currentStep: number;
  submittedAt: string;
  notes?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  subType?: string;
  amount?: string | number;
  asset?: string;
  items?: string[] | string;
  attachments?: Attachment[] | string;
  approvalHistory?: ApprovalHistoryEntry[] | string;
}

export interface RosterMember {
  id: string;
  name: string;
  email: string;
  team?: string;
  managerId?: string;
}

export interface ApprovalChains {
  [reqType: string]: ApprovalRole[];
}

export interface Assignees {
  [reqType: string]: string[];
}

export interface Quotas {
  adminEmails?: string[];
  ceoEmail?: string;
  slackWebhook?: string;
  appUrl?: string;
  driveFolderId?: string;
  approvalChains?: ApprovalChains;
  assignees?: Assignees;
  emailNotifications?: boolean;
}

export interface User {
  name: string;
  email: string;
  picture?: string;
  exp?: number;
  id_token?: string;
}

export interface Notification {
  id: string;
  targetEmail: string;
  type: "approval_required" | "completed" | "rejected";
  title: string;
  message: string;
  requestId?: string;
  read: string | boolean;
  createdAt: string;
}

export type ApiResponse<T = unknown> =
  | { ok: true;  data: T }
  | { ok: false; error: string };
