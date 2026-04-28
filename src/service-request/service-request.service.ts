import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../common/s3.service';
import { ReportNotificationsGateway } from '../report/report-notifications.gateway';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';

type ServiceRequestAttachmentFile = {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
};

const SERVICE_REQUEST_SELECT = {
  id: true,
  requestType: true,
  driverAction: true,
  personName: true,
  plate: true,
  reason: true,
  attachmentKey: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  requester: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

type ServiceRequestRecord = {
  id: number;
  requestType: string;
  driverAction: string | null;
  personName: string | null;
  plate: string | null;
  reason: string | null;
  attachmentKey: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  requester: {
    id: number;
    name: string | null;
    email: string;
  };
};

@Injectable()
export class ServiceRequestService {
  private readonly maxAttachmentBytes = 10 * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly reportNotificationsGateway: ReportNotificationsGateway,
  ) {}

  private toResponse(request: ServiceRequestRecord) {
    return {
      id: request.id,
      tipo: request.requestType,
      conductorOpcion: request.driverAction,
      nombre: request.personName,
      patente: request.plate,
      razon: request.reason,
      archivoKey: request.attachmentKey,
      attachmentKey: request.attachmentKey,
      estado: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      requester: request.requester,
    };
  }

  private normalizeRequestType(dto: CreateServiceRequestDto): string {
    if (dto.tipo === 'patente') return 'patente';
    return dto.conductorOpcion === 'baja'
      ? 'conductor_baja'
      : 'conductor_anadir';
  }

  private normalizeText(value?: string): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private validate(dto: CreateServiceRequestDto) {
    if (dto.tipo === 'conductor') {
      if (!dto.conductorOpcion || !['anadir', 'baja'].includes(dto.conductorOpcion)) {
        throw new BadRequestException('Debes seleccionar una opcion de conductor.');
      }

      if (!this.normalizeText(dto.nombre)) {
        throw new BadRequestException('Debes ingresar el nombre del usuario.');
      }
    }

    if (dto.tipo === 'patente' && !this.normalizeText(dto.patente)) {
      throw new BadRequestException('Debes ingresar la patente.');
    }
  }

  private getAttachmentExtension(file: ServiceRequestAttachmentFile): string {
    const normalized = (file.mimetype || '').toLowerCase().trim();
    const byMimeType: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
    };

    const extension = byMimeType[normalized];
    if (!extension) {
      throw new BadRequestException(
        'Solo se permiten archivos PDF o imagenes PNG, JPEG o WEBP.',
      );
    }

    return extension;
  }

  private buildAttachmentKey(
    requesterId: number,
    file: ServiceRequestAttachmentFile,
  ): string {
    const extension = this.getAttachmentExtension(file);
    return `service-requests/${requesterId}/${randomUUID()}.${extension}`;
  }

  private validateAttachment(file?: ServiceRequestAttachmentFile) {
    if (!file) return;

    if (file.size > this.maxAttachmentBytes) {
      throw new BadRequestException(
        'El archivo adjunto no puede superar los 10 MB.',
      );
    }

    this.getAttachmentExtension(file);
  }

  async create(
    requesterId: number,
    dto: CreateServiceRequestDto,
    file?: ServiceRequestAttachmentFile,
  ) {
    this.validate(dto);
    this.validateAttachment(file);

    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { id: true },
    });

    if (!requester) {
      throw new NotFoundException('Usuario solicitante no encontrado.');
    }

    let attachmentKey: string | null = null;

    if (file) {
      attachmentKey = this.buildAttachmentKey(requesterId, file);
      await this.s3Service.uploadAttachmentBuffer({
        buffer: file.buffer,
        contentType: file.mimetype,
        key: attachmentKey,
      });
    }

    let request: ServiceRequestRecord;

    try {
      request = await this.prisma.serviceRequest.create({
        data: {
          requesterId,
          requestType: this.normalizeRequestType(dto),
          driverAction: this.normalizeText(dto.conductorOpcion),
          personName: this.normalizeText(dto.nombre),
          plate: this.normalizeText(dto.patente)?.toUpperCase() ?? null,
          reason: this.normalizeText(dto.razon),
          attachmentKey,
        },
        select: SERVICE_REQUEST_SELECT,
      });
    } catch (error) {
      if (attachmentKey) {
        await this.s3Service.deleteObject(attachmentKey);
      }
      throw error;
    }

    this.reportNotificationsGateway.emitServiceRequestCreatedToAdmins({
      serviceRequestId: request.id,
      tipo: request.requestType,
      conductorOpcion: request.driverAction,
      nombre: request.personName,
      patente: request.plate,
      razon: request.reason,
      estado: request.status,
      createdAt: request.createdAt,
      requester: request.requester,
    });

    return this.toResponse(request);
  }

  async findMine(requesterId: number) {
    const requests = await this.prisma.serviceRequest.findMany({
      where: { requesterId },
      orderBy: { createdAt: 'desc' },
      select: SERVICE_REQUEST_SELECT,
    });

    return requests.map((request) => this.toResponse(request));
  }

  async getAttachmentUrl(requesterId: number, id: number) {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { id: true, role: true },
    });

    if (!requester) {
      throw new NotFoundException('Usuario solicitante no encontrado.');
    }

    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: {
        id: true,
        requesterId: true,
        attachmentKey: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Service request not found.');
    }

    if (
      requester.role !== UserRole.ADMIN &&
      request.requesterId !== requester.id
    ) {
      throw new ForbiddenException('No tienes acceso a este archivo.');
    }

    if (!request.attachmentKey) {
      throw new NotFoundException('La solicitud no tiene archivo adjunto.');
    }

    return {
      url: await this.s3Service.getSignedGetUrl(request.attachmentKey),
      archivoKey: request.attachmentKey,
      attachmentKey: request.attachmentKey,
    };
  }

  async findAll() {
    const requests = await this.prisma.serviceRequest.findMany({
      orderBy: { createdAt: 'desc' },
      select: SERVICE_REQUEST_SELECT,
    });

    return requests.map((request) => this.toResponse(request));
  }

  async updateStatus(id: number, status: string) {
    const existing = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Service request not found.');
    }

    const request = await this.prisma.serviceRequest.update({
      where: { id },
      data: { status },
      select: SERVICE_REQUEST_SELECT,
    });

    return this.toResponse(request);
  }
}
