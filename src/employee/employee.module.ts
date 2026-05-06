import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeController],
  providers: [EmployeeService, RolesGuard],
  exports: [EmployeeService],
})
export class EmployeeModule {}
