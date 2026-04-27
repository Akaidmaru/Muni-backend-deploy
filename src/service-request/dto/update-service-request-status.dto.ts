import { IsIn } from 'class-validator';

export class UpdateServiceRequestStatusDto {
  @IsIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'])
  estado: string;
}
