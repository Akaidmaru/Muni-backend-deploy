import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { TruckModule } from './truck/truck.module';
import { RouteModule } from './route/route.module';
import { OccupationModule } from './occupation/occupation.module';
import { DestinationModule } from './destination/destination.module';
import { TripHistoryModule } from './trip-history/trip-history.module';
import { VehicleMaintenanceRecordModule } from './vehicle-maintenance-record/vehicle-maintenance-record.module';

@Module({
  imports: [
    RedisModule,
    UserModule,
    PrismaModule,
    AuthModule,
    TruckModule,
    RouteModule,
    OccupationModule,
    DestinationModule,
    TripHistoryModule,
    VehicleMaintenanceRecordModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
