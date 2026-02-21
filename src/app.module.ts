import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { TruckModule } from './truck/truck.module';

@Module({
  imports: [RedisModule, UserModule, PrismaModule, AuthModule, TruckModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
