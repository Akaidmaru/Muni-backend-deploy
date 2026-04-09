import { Module } from '@nestjs/common';
import { RouteController } from './route.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleRoadsService } from './googleRoads.service';

@Module({
  imports: [PrismaModule],
  controllers: [RouteController],
  providers: [GoogleRoadsService],
  exports: [GoogleRoadsService],
})
export class RouteModule {}
