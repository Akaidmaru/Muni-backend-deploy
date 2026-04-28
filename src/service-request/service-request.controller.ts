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
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestStatusDto } from './dto/update-service-request-status.dto';
import { ServiceRequestService } from './service-request.service';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

type UploadedAttachmentFile = {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
};

@Controller('solicitudes')
export class ServiceRequestController {
  constructor(private readonly serviceRequestService: ServiceRequestService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DIRECTION')
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
        ];
        if (!allowed.includes((file.mimetype || '').toLowerCase())) {
          return cb(new Error('Tipo de archivo no permitido'), false);
        }
        return cb(null, true);
      },
    }),
  )
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateServiceRequestDto,
    @UploadedFile() file?: UploadedAttachmentFile,
  ) {
    return this.serviceRequestService.create(Number(req.user.id), dto, file);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DIRECTION')
  findMine(@Req() req: AuthenticatedRequest) {
    return this.serviceRequestService.findMine(Number(req.user.id));
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  findAll() {
    return this.serviceRequestService.findAll();
  }

  @Get(':id/archivo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DIRECTION')
  getAttachmentUrl(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.serviceRequestService.getAttachmentUrl(Number(req.user.id), id);
  }

  @Patch(':id/estado')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceRequestStatusDto,
  ) {
    return this.serviceRequestService.updateStatus(id, dto.estado);
  }
}
