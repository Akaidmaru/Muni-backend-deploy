import { Module } from '@nestjs/common';
import { TruckController } from './truck.controller';
import { TruckExpiryService } from './truck-expiry.service';
import { TruckService } from './truck.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportModule } from '../report/report.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, ReportModule, CommonModule],
  controllers: [TruckController],
  providers: [TruckService, TruckExpiryService],
})
export class TruckModule {}
