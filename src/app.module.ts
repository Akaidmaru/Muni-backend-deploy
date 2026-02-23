import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { TruckModule } from './truck/truck.module';
import { RouteModule } from './route/route.module';

@Module({
  imports: [
    RedisModule,
    UserModule,
    PrismaModule,
    AuthModule,
    TruckModule,
    RouteModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
