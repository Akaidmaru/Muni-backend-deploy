import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeService, type EmployeeResponse } from './employee.service';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

@Controller('employees')
@UseGuards(JwtAuthGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  async findActive(@Req() req: AuthenticatedRequest): Promise<EmployeeResponse[]> {
    return this.employeeService.findActive(Number(req.user.id));
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DIRECTION')
  async findAll(@Req() req: AuthenticatedRequest): Promise<EmployeeResponse[]> {
    return this.employeeService.findAll(Number(req.user.id));
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<EmployeeResponse> {
    return this.employeeService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DIRECTION')
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateEmployeeDto,
  ): Promise<EmployeeResponse> {
    return this.employeeService.create(Number(req.user.id), dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DIRECTION')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<EmployeeResponse> {
    return this.employeeService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DIRECTION')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.employeeService.remove(id);
  }
}
