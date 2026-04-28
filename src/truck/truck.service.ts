import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTruckDto } from './dto/create-truck.dto';
import { UpdateTruckDto } from './dto/update-truck.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import {
  Prisma,
  PlateChangeReason,
  TruckDocumentType,
  TruckStatus,
  UserRole,
} from '@prisma/client';
import { RegisterPlateChangeDto } from './dto/register-plate-change.dto';
import { S3Service } from '../common/s3.service';
import { UploadTruckDocumentDto } from './dto/upload-truck-document.dto';

type UploadedTruckDocumentFile = {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
};

@Injectable()
export class TruckService {
  private readonly maxDocumentBytes = 20 * 1024 * 1024;

  constructor(
    private prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  private readonly truckDocumentSelect = {
    id: true,
    truckId: true,
    documentType: true,
    bucketKey: true,
    uploadedAt: true,
  } as const;

  private parseDocumentType(value: string): TruckDocumentType {
    const normalized = String(value || '').trim().toUpperCase();
    const allowed = Object.values(TruckDocumentType) as string[];

    if (!allowed.includes(normalized)) {
      throw new BadRequestException('Tipo de documento no valido.');
    }

    return normalized as TruckDocumentType;
  }

  private resolveExpiryDateByType(
    truck: Pick<
      Prisma.TruckGetPayload<{
        select: {
          technicalReviewExpiresAt: true;
          circulationPermitExpiresAt: true;
          insuranceExpiresAt: true;
          emissionsExpiresAt: true;
        };
      }>,
      | 'technicalReviewExpiresAt'
      | 'circulationPermitExpiresAt'
      | 'insuranceExpiresAt'
      | 'emissionsExpiresAt'
    >,
    documentType: TruckDocumentType,
  ) {
    switch (documentType) {
      case TruckDocumentType.TECHNICAL_REVIEW:
        return truck.technicalReviewExpiresAt;
      case TruckDocumentType.CIRCULATION_PERMIT:
        return truck.circulationPermitExpiresAt;
      case TruckDocumentType.INSURANCE:
        return truck.insuranceExpiresAt;
      case TruckDocumentType.EMISSIONS:
        return truck.emissionsExpiresAt;
      default:
        return null;
    }
  }

  private getDocumentExtension(file: UploadedTruckDocumentFile): string {
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

  private buildDocumentKey(
    truckId: number,
    documentType: TruckDocumentType,
    file: UploadedTruckDocumentFile,
  ): string {
    const extension = this.getDocumentExtension(file);
    return `truck-documents/${truckId}/${documentType.toLowerCase()}-${randomUUID()}.${extension}`;
  }

  private validateDocumentFile(file?: UploadedTruckDocumentFile) {
    if (!file) {
      throw new BadRequestException('Debes adjuntar un archivo.');
    }

    if (file.size > this.maxDocumentBytes) {
      throw new BadRequestException(
        'El archivo no puede superar los 20 MB.',
      );
    }

    this.getDocumentExtension(file);
  }

  private formatTruckDocumentResponse(
    document: {
      id: number;
      truckId: number;
      documentType: TruckDocumentType;
      bucketKey: string;
      uploadedAt: Date;
    },
    expiresAt: Date | null | undefined,
  ) {
    return {
      id: document.id,
      truckId: document.truckId,
      documentType: document.documentType,
      bucketKey: document.bucketKey,
      uploadedAt: document.uploadedAt,
      expiresAt: expiresAt ?? null,
    };
  }

  private sanitizeTruckCreateInput(
    dto: CreateTruckDto,
  ): Prisma.TruckUncheckedCreateInput {
    const data: Prisma.TruckUncheckedCreateInput = {
      ...dto,
    };

    data.plate = dto.plate.trim().toUpperCase();
    data.model = dto.model.trim();

    if (typeof dto.brand === 'string') {
      data.brand = dto.brand.trim();
    }

    return data;
  }

  private sanitizeTruckUpdateInput(
    dto: UpdateTruckDto,
  ): Prisma.TruckUncheckedUpdateInput {
    const data: Prisma.TruckUncheckedUpdateInput = {
      ...dto,
    };

    if (typeof dto.plate === 'string') {
      data.plate = dto.plate.trim().toUpperCase();
    }

    if (typeof dto.model === 'string') {
      data.model = dto.model.trim();
    }

    if (typeof dto.brand === 'string') {
      data.brand = dto.brand.trim();
    }

    const dateFields: Array<
      'technicalReviewExpiresAt' | 'circulationPermitExpiresAt' | 'insuranceExpiresAt' | 'emissionsExpiresAt'
    > = [
      'technicalReviewExpiresAt',
      'circulationPermitExpiresAt',
      'insuranceExpiresAt',
      'emissionsExpiresAt',
    ];

    for (const field of dateFields) {
      if (dto[field] === null) {
        data[field] = null;
      }
    }

    return data;
  }

  private async getManagedById(userId: number): Promise<number | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === UserRole.ADMIN) return undefined;
    return userId;
  }

  async create(userId: number, dto: CreateTruckDto) {
    const managedById = await this.getManagedById(userId);
    const data = this.sanitizeTruckCreateInput(dto);
    data.managedById = managedById ?? null;

    try {
      return await this.prisma.truck.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('La patente ya está registrada');
      }

      throw error;
    }
  }

  async findAll(userId: number) {
    const managedById = await this.getManagedById(userId);

    return this.prisma.truck.findMany({
      where: { managedById },
      include: {
        users: {
          where: {
            user: {
              role: UserRole.DRIVER,
            },
          },
          select: {
            userId: true,
            truckId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });
  }

  async findUnassigned(userId: number) {
    const managedById = await this.getManagedById(userId);

    return this.prisma.truck.findMany({
      where: {
        managedById,
        users: {
          none: {
            user: {
              role: UserRole.DRIVER,
            },
          },
        },
      },
      select: {
        id: true,
        plate: true,
      },
    });
  }

  async findOne(id: number) {
    const truck = await this.prisma.truck.findUnique({
      where: { id },
      include: {
        users: {
          where: {
            user: {
              role: UserRole.DRIVER,
            },
          },
          select: {
            userId: true,
            truckId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!truck) {
      throw new NotFoundException(`Camión con ID ${id} no encontrado`);
    }

    return truck;
  }

  async getDocuments(truckId: number) {
    const truck = await this.prisma.truck.findUnique({
      where: { id: truckId },
      select: {
        id: true,
        technicalReviewExpiresAt: true,
        circulationPermitExpiresAt: true,
        insuranceExpiresAt: true,
        emissionsExpiresAt: true,
        documents: {
          orderBy: { documentType: 'asc' },
          select: this.truckDocumentSelect,
        },
      },
    });

    if (!truck) {
      throw new NotFoundException(`Camión con ID ${truckId} no encontrado`);
    }

    return truck.documents.map((document) =>
      this.formatTruckDocumentResponse(
        document,
        this.resolveExpiryDateByType(truck, document.documentType),
      ),
    );
  }

  async getDocumentUrl(truckId: number, documentTypeValue: string) {
    const documentType = this.parseDocumentType(documentTypeValue);

    const document = await this.prisma.truckDocument.findUnique({
      where: {
        truckId_documentType: {
          truckId,
          documentType,
        },
      },
      select: this.truckDocumentSelect,
    });

    if (!document) {
      throw new NotFoundException('Documento del vehiculo no encontrado.');
    }

    return {
      truckId: document.truckId,
      documentType: document.documentType,
      bucketKey: document.bucketKey,
      url: await this.s3Service.getSignedGetUrl(document.bucketKey),
    };
  }

  async uploadDocument(
    truckId: number,
    dto: UploadTruckDocumentDto,
    file?: UploadedTruckDocumentFile,
  ) {
    this.validateDocumentFile(file);

    const truck = await this.prisma.truck.findUnique({
      where: { id: truckId },
      select: {
        id: true,
        technicalReviewExpiresAt: true,
        circulationPermitExpiresAt: true,
        insuranceExpiresAt: true,
        emissionsExpiresAt: true,
      },
    });

    if (!truck) {
      throw new NotFoundException(`Camión con ID ${truckId} no encontrado`);
    }

    const newBucketKey = this.buildDocumentKey(truckId, dto.documentType, file!);
    await this.s3Service.uploadAttachmentBuffer({
      buffer: file!.buffer,
      contentType: file!.mimetype,
      key: newBucketKey,
    });

    const existing = await this.prisma.truckDocument.findUnique({
      where: {
        truckId_documentType: {
          truckId,
          documentType: dto.documentType,
        },
      },
      select: this.truckDocumentSelect,
    });

    try {
      const document = await this.prisma.truckDocument.upsert({
        where: {
          truckId_documentType: {
            truckId,
            documentType: dto.documentType,
          },
        },
        create: {
          truckId,
          documentType: dto.documentType,
          bucketKey: newBucketKey,
        },
        update: {
          bucketKey: newBucketKey,
          uploadedAt: new Date(),
        },
        select: this.truckDocumentSelect,
      });

      if (existing?.bucketKey && existing.bucketKey !== newBucketKey) {
        await this.s3Service.deleteObject(existing.bucketKey);
      }

      return this.formatTruckDocumentResponse(
        document,
        this.resolveExpiryDateByType(truck, document.documentType),
      );
    } catch (error) {
      await this.s3Service.deleteObject(newBucketKey);
      throw error;
    }
  }

  async removeDocument(truckId: number, documentId: number) {
    const document = await this.prisma.truckDocument.findFirst({
      where: {
        id: documentId,
        truckId,
      },
      select: this.truckDocumentSelect,
    });

    if (!document) {
      throw new NotFoundException('Documento del vehiculo no encontrado.');
    }

    await this.prisma.truckDocument.delete({
      where: {
        id: documentId,
      },
    });

    await this.s3Service.deleteObject(document.bucketKey);

    return {
      message: 'Documento eliminado correctamente.',
      id: document.id,
      truckId: document.truckId,
      documentType: document.documentType,
    };
  }

  async update(id: number, dto: UpdateTruckDto) {
    await this.findOne(id);

    const data = this.sanitizeTruckUpdateInput(dto);

    try {
      return await this.prisma.truck.update({ where: { id }, data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('La patente ya está registrada');
      }

      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    try {
      return await this.prisma.truck.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'No se puede eliminar la patente porque tiene registros asociados',
        );
      }

      throw error;
    }
  }

  async assignUser(dto: AssignUserDto) {
    const [truck, user] = await Promise.all([
      this.prisma.truck.findUnique({ where: { id: dto.truckId }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } }),
    ]);

    if (!truck) {
      throw new NotFoundException(`Camión con ID ${dto.truckId} no encontrado`);
    }

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${dto.userId} no encontrado`);
    }

    const existing = await this.prisma.truckAssignment.findUnique({
      where: { userId_truckId: { userId: dto.userId, truckId: dto.truckId } },
    });

    if (existing) {
      throw new BadRequestException('El usuario ya está asignado a este camión');
    }

    try {
      return await this.prisma.truckAssignment.create({
        data: {
          userId: dto.userId,
          truckId: dto.truckId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('El usuario ya está asignado a este camión');
      }
      throw error;
    }
  }

  async getUsersOfTruck(truckId: number) {
    const assignments = await this.prisma.truckAssignment.findMany({
      where: { truckId },
      include: { user: true },
    });
    return assignments.map((a) => a.user);
  }

  async registerPlateChange(userId: number, dto: RegisterPlateChangeDto) {
    return this.prisma.$transaction(async (tx) => {
      const truck = await tx.truck.findUnique({
        where: { id: dto.truckId },
        select: { id: true, status: true },
      });

      if (!truck) {
        throw new NotFoundException('Camión no encontrado');
      }

      const previousStatus = truck.status;
      const newStatus =
        dto.reason === PlateChangeReason.AVERIA
          ? TruckStatus.INACTIVE
          : previousStatus;

      if (newStatus !== previousStatus) {
        await tx.truck.update({
          where: { id: dto.truckId },
          data: { status: newStatus },
        });
      }

      const log = await tx.truckPlateChangeLog.create({
        data: {
          truckId: dto.truckId,
          changedByUserId: userId,
          reason: dto.reason,
          observations: dto.observations.trim(),
          previousStatus,
          newStatus,
        },
      });

      return {
        id: log.id,
        truckId: log.truckId,
        reason: log.reason,
        observations: log.observations,
        previousStatus: log.previousStatus,
        newStatus: log.newStatus,
        createdAt: log.createdAt,
      };
    });
  }

  async getOutOfServiceAlerts() {
    const logs = await this.prisma.truckPlateChangeLog.findMany({
      where: {
        reason: PlateChangeReason.AVERIA,
        newStatus: TruckStatus.INACTIVE,
        truck: {
          status: TruckStatus.INACTIVE,
        },
      },
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
          },
        },
        changedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const seenTruckIds = new Set<number>();
    const latestPerTruck = logs.filter((log) => {
      if (seenTruckIds.has(log.truckId)) {
        return false;
      }
      seenTruckIds.add(log.truckId);
      return true;
    });

    return latestPerTruck.map((log) => ({
      id: log.id,
      truckId: log.truckId,
      plate: log.truck.plate,
      driver:
        log.changedBy.name || log.changedBy.email || `Usuario ${log.changedBy.id}`,
      category: 'Avería',
      observation: log.observations,
      reportedAt: log.createdAt,
    }));
  }
}
