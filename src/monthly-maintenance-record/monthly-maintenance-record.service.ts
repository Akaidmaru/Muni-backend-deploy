import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MonthlyMaintenanceRecordStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertMonthlyMaintenanceRecordDto } from './dto';

@Injectable()
export class MonthlyMaintenanceRecordService {
  constructor(private readonly prisma: PrismaService) {}

  private async getManagedById(requesterId: number): Promise<number | undefined> {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });
    if (requester?.role === UserRole.ADMIN) return undefined;
    return requesterId;
  }

  private statusSeverity(status: string) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'malo') return 3;
    if (normalized === 'regular') return 2;
    if (normalized === 'bueno') return 1;
    return 0;
  }

  private dedupeMonthlyItems(items: UpsertMonthlyMaintenanceRecordDto['monthlyMaintenanceItems']) {
    const deduped = new Map<string, (typeof items)[number]>();

    for (const item of items) {
      const key = `${item.weekIndex}-${item.itemCode}`;
      const current = deduped.get(key);

      if (!current) {
        deduped.set(key, item);
        continue;
      }

      const currentSeverity = this.statusSeverity(current.status);
      const nextSeverity = this.statusSeverity(item.status);

      if (nextSeverity > currentSeverity) {
        deduped.set(key, {
          ...item,
          notes: item.notes || current.notes,
        });
        continue;
      }

      if (nextSeverity === currentSeverity && !current.notes && item.notes) {
        deduped.set(key, {
          ...current,
          notes: item.notes,
        });
      }
    }

    return Array.from(deduped.values());
  }

  private deriveRecordStatus(
    items: UpsertMonthlyMaintenanceRecordDto['monthlyMaintenanceItems'],
  ): MonthlyMaintenanceRecordStatus {
    const hasProblematicItem = items.some((item) => {
      const normalized = String(item.status || '').trim().toLowerCase();
      return normalized === 'regular' || normalized === 'malo';
    });

    return hasProblematicItem
      ? MonthlyMaintenanceRecordStatus.PENDING
      : MonthlyMaintenanceRecordStatus.REVIEWED;
  }

  private parseMonthKey(monthKey: string) {
    const monthMatch = /^(\d{4})-(\d{2})$/.exec(monthKey);
    if (!monthMatch) {
      throw new BadRequestException('Formato de month inválido. Use YYYY-MM');
    }

    const year = Number(monthMatch[1]);
    const monthNum = Number(monthMatch[2]);

    if (monthNum < 1 || monthNum > 12) {
      throw new BadRequestException('Mes inválido en parámetro month');
    }

    return { year, monthNum };
  }

  async findAllAdmin(requesterId: number) {
    const managedById = await this.getManagedById(requesterId);
    return await this.prisma.monthlyMaintenanceRecord.findMany({
      where: managedById !== undefined ? { truck: { managedById } } : undefined,
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            brand: true,
            model: true,
            year: true,
            seatCount: true,
            technicalReviewExpiresAt: true,
            circulationPermitExpiresAt: true,
            insuranceExpiresAt: true,
            emissionsExpiresAt: true,
          },
        },
        monthlyMaintenanceItems: true,
      },
      orderBy: [{ monthKey: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async findAdminByTruckAndMonth(truckId: number, monthKey: string) {
    this.parseMonthKey(monthKey);

    const record = await this.prisma.monthlyMaintenanceRecord.findUnique({
      where: {
        truckId_monthKey: {
          truckId,
          monthKey,
        },
      },
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            brand: true,
            model: true,
            year: true,
            seatCount: true,
            technicalReviewExpiresAt: true,
            circulationPermitExpiresAt: true,
            insuranceExpiresAt: true,
            emissionsExpiresAt: true,
          },
        },
        monthlyMaintenanceItems: true,
      },
    });

    if (!record) {
      return null;
    }

    return record;
  }

  async upsertAdmin(dto: UpsertMonthlyMaintenanceRecordDto) {
    this.parseMonthKey(dto.monthKey);

    const truck = await this.prisma.truck.findUnique({ where: { id: dto.truckId } });
    if (!truck) {
      throw new NotFoundException(`Truck con ID ${dto.truckId} no encontrado`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const sanitizedItems = this.dedupeMonthlyItems(dto.monthlyMaintenanceItems);
      const computedStatus = this.deriveRecordStatus(sanitizedItems);

      const baseRecord = await tx.monthlyMaintenanceRecord.upsert({
        where: {
          truckId_monthKey: {
            truckId: dto.truckId,
            monthKey: dto.monthKey,
          },
        },
        create: {
          truckId: dto.truckId,
          monthKey: dto.monthKey,
          status: computedStatus,
        },
        update: {
          status: computedStatus,
        },
      });

      await tx.monthlyMaintenanceItem.deleteMany({
        where: { recordId: baseRecord.id },
      });

      if (sanitizedItems.length > 0) {
        await tx.monthlyMaintenanceItem.createMany({
          data: sanitizedItems.map((item) => ({
            recordId: baseRecord.id,
            weekIndex: item.weekIndex,
            itemCode: item.itemCode,
            itemName: item.itemName,
            category: item.category,
            status: item.status,
            notes: item.notes,
          })),
        });
      }

      return await tx.monthlyMaintenanceRecord.findUnique({
        where: { id: baseRecord.id },
        include: {
          truck: {
            select: {
              id: true,
              plate: true,
              brand: true,
              model: true,
              year: true,
              seatCount: true,
              technicalReviewExpiresAt: true,
              circulationPermitExpiresAt: true,
              insuranceExpiresAt: true,
              emissionsExpiresAt: true,
            },
          },
          monthlyMaintenanceItems: true,
        },
      });
    });
  }

  async updateStatusAdmin(
    recordId: number,
    status: MonthlyMaintenanceRecordStatus,
  ) {
    const existing = await this.prisma.monthlyMaintenanceRecord.findUnique({
      where: { id: recordId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Registro mensual con ID ${recordId} no encontrado`);
    }

    return await this.prisma.monthlyMaintenanceRecord.update({
      where: { id: recordId },
      data: { status },
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            brand: true,
            model: true,
            year: true,
            seatCount: true,
            technicalReviewExpiresAt: true,
            circulationPermitExpiresAt: true,
            insuranceExpiresAt: true,
            emissionsExpiresAt: true,
          },
        },
        monthlyMaintenanceItems: true,
      },
    });
  }
}
