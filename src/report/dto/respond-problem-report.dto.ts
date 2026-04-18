import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  PROBLEM_REPORT_STATUSES,
  type ProblemReportStatusValue,
} from './update-problem-report-status.dto';

export class RespondProblemReportDto {
  @IsOptional()
  @IsIn(PROBLEM_REPORT_STATUSES)
  status?: ProblemReportStatusValue;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(3000)
  note?: string;
}
