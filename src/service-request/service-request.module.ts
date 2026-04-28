import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CommonModule } from '../common/common.module';
import { ReportModule } from '../report/report.module';
import { ServiceRequestController } from './service-request.controller';
import { ServiceRequestService } from './service-request.service';

@Module({
  imports: [PrismaModule, CommonModule, ReportModule],
  controllers: [ServiceRequestController],
  providers: [ServiceRequestService, RolesGuard],
})
export class ServiceRequestModule {}
