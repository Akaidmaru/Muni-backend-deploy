import { IsInt, Min } from 'class-validator';

export class AssignTripPatientDto {
  @IsInt()
  @Min(1)
  patientId!: number;
}
