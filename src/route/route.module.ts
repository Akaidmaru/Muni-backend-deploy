import { Module } from '@nestjs/common';
import { RouteController } from './route.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleRoadsService } from './googleRoads.service';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [RouteController],
  providers: [GoogleRoadsService, RolesGuard],
  exports: [GoogleRoadsService],
})
export class RouteModule {}
