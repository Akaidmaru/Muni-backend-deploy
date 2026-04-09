import { IsString, Matches } from 'class-validator';

export class FinishTripDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime: string;

  @IsString()
  @Matches(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, {
    message: 'La firma debe ser una imagen en formato base64 data URL',
  })
  signature: string;
}
