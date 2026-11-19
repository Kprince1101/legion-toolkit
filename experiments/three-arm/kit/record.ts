import type { Arm } from './arms.ts';
import type { TamperReport } from './guards.ts';
import type { AcceptanceSummary, AuditSummary, StepResult } from './reports.ts';
import type { TranscriptReport } from './transcript.ts';
import type { FileSize } from './tree.ts';

export interface RunMeta {
  schema: 1;
  arm: Arm;
  runId: string;
  workspace: string;
  createdAt: string;
  kitCommit: string | null;
  toolkit: string | null;
}

export interface StepLint {
  step: string;
  lintErrors: number;
  legionFindings: number;
  componentCap: number;
  directives: number;
}

export interface RunRecord {
  schema: 1;
  arm: Arm;
  runId: string;
  collectedAt: string;
  acceptance: AcceptanceSummary;
  audit: AuditSummary | null;
  auditError: string | null;
  tsSuppressions: number;
  largest: FileSize[];
  tsxOver180: number;
  filesOver500: number;
  transcript: TranscriptReport | null;
  transcriptFiles: string[];
  steps: StepResult[];
  costUsd: number | null;
  tampered: TamperReport;
  perStep: StepLint[];
}
