import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportController } from './report.controller';
import { ReportNotificationsGateway } from './report-notifications.gateway';
import { ReportService } from './report.service';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required but not set');
        }
        return { secret };
      },
    }),
  ],
  controllers: [ReportController],
  providers: [ReportService, RolesGuard, ReportNotificationsGateway],
  exports: [ReportNotificationsGateway],
})
export class ReportModule {}
