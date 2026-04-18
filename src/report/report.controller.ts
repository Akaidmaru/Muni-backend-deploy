import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProblemReportDto } from './dto/create-problem-report.dto';
import { RespondProblemReportDto } from './dto/respond-problem-report.dto';
import { UpdateProblemReportStatusDto } from './dto/update-problem-report-status.dto';
import { ReportService } from './report.service';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

type UploadedImageFile = {
  buffer: Buffer;
  size: number;
  mimetype: string;
};

@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (!allowed.includes((file.mimetype || '').toLowerCase())) {
          return cb(new Error('Tipo de archivo no permitido'), false);
        }
        return cb(null, true);
      },
    }),
  )
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateProblemReportDto,
    @UploadedFile() file?: UploadedImageFile,
  ): Promise<unknown> {
    return this.reportService.create(req.user.id, dto, file);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async findMine(@Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.reportService.findMine(req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findAll(): Promise<unknown> {
    return this.reportService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.reportService.findOne(id);
  }

  @Get(':id/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findTimeline(@Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.reportService.findTimeline(id);
  }

  @Patch(':id/respond')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async respondToReport(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RespondProblemReportDto,
  ): Promise<unknown> {
    return this.reportService.respondToReport(id, req.user.id, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProblemReportStatusDto,
  ): Promise<unknown> {
    return this.reportService.updateStatus(id, req.user.id, dto.status);
  }
}
