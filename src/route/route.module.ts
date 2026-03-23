import { Module } from '@nestjs/common';
import { RouteService } from './route.service';
import { RouteController } from './route.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleRoadsService } from './googleRoads.service';

@Module({
  imports: [PrismaModule],
  controllers: [RouteController],
  providers: [RouteService, GoogleRoadsService],
})
export class RouteModule {}
