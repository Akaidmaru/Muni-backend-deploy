import { IsString, Matches, MaxLength } from 'class-validator';

export class FinishTripDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime: string;

  @IsString()
  @MaxLength(2_097_152, { message: 'La firma no puede superar 1.5 MB en base64' })
  @Matches(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, {
    message: 'La firma debe ser una imagen en formato base64 data URL',
  })
  signature: string;
}
