import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { S3Service } from './s3.service';
@Module({
  providers: [MailService, S3Service],
  exports: [MailService, S3Service],
})
export class CommonModule {}
