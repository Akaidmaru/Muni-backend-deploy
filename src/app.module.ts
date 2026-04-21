import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { TruckModule } from './truck/truck.module';
import { RouteModule } from './route/route.module';
import { OccupationModule } from './occupation/occupation.module';
import { DestinationModule } from './destination/destination.module';
import { ReportModule } from './report/report.module';
import { EmployeeModule } from './employee/employee.module';
import { TripHistoryModule } from './trip-history/trip-history.module';
import { DailyMaintenanceRecordModule } from './daily-maintenance-record/daily-maintenance-record.module';
import { MonthlyMaintenanceRecordModule } from './monthly-maintenance-record/monthly-maintenance-record.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 60 },
      { name: 'login-short', ttl: 60_000, limit: 3 },
      { name: 'login-long', ttl: 300_000, limit: 10 },
    ]),
    RedisModule,
    UserModule,
    PrismaModule,
    AuthModule,
    TruckModule,
    RouteModule,
    OccupationModule,
    DestinationModule,
    EmployeeModule,
    ReportModule,
    TripHistoryModule,
    DailyMaintenanceRecordModule,
    MonthlyMaintenanceRecordModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
