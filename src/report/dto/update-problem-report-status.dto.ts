import { IsIn } from 'class-validator';

const PROBLEM_REPORT_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED'] as const;
export type ProblemReportStatusValue = (typeof PROBLEM_REPORT_STATUSES)[number];

export class UpdateProblemReportStatusDto {
  @IsIn(PROBLEM_REPORT_STATUSES)
  status!: ProblemReportStatusValue;
}
