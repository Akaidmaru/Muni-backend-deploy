import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertMonthlyMaintenanceRecordDto } from './dto';

@Injectable()
export class MonthlyMaintenanceRecordService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findAllAdmin() {
    return await this.prisma.monthlyMaintenanceRecord.findMany({
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
        },
        update: {},
      });

      await tx.monthlyMaintenanceItem.deleteMany({
        where: { recordId: baseRecord.id },
      });

      const sanitizedItems = this.dedupeMonthlyItems(dto.monthlyMaintenanceItems);

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
}
