import { Module } from '@nestjs/common';
import { DestinationController } from './destination.controller';
import { DestinationService } from './destination.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DestinationController],
  providers: [DestinationService],
})
export class DestinationModule {}
