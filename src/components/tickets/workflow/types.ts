import type { WorkflowKey } from "@/lib/workflows";

export interface StageRow {
  id: string;
  ticket_id: string;
  workflow_key: string;
  stage_key: string;
  stage_label: string;
  order_index: number;
  status: "pending" | "in_progress" | "complete" | "skipped";
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  skipped_reason: string | null;
}

export interface StepRow {
  id: string;
  ticket_id: string;
  workflow_key: string;
  stage_key: string;
  step_key: string;
  step_label: string;
  step_description: string | null;
  order_index: number;
  is_required: boolean;
  status: "pending" | "complete" | "skipped";
  completed_at: string | null;
  completed_by: string | null;
  note: string | null;
}

export interface WorkflowState {
  workflowKey: WorkflowKey;
  stages: StageRow[];
  steps: StepRow[];
}

export type PersonNameLookup = (id: string | null) => string | null;