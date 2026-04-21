import { Module } from '@nestjs/common';
import { TruckController } from './truck.controller';
import { TruckExpiryService } from './truck-expiry.service';
import { TruckService } from './truck.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportModule } from '../report/report.module';

@Module({
  imports: [PrismaModule, ReportModule],
  controllers: [TruckController],
  providers: [TruckService, TruckExpiryService],
})
export class TruckModule {}
