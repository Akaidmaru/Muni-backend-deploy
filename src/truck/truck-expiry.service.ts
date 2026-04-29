import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  ReportNotificationsGateway,
  TruckExpiryPayload,
} from '../report/report-notifications.gateway';

const DOCUMENT_FIELDS = [
  { field: 'technicalReviewExpiresAt', label: 'Revisión Técnica' },
  { field: 'circulationPermitExpiresAt', label: 'Permiso de Circulación' },
  { field: 'insuranceExpiresAt', label: 'Seguro Obligatorio (SOAP)' },
  { field: 'emissionsExpiresAt', label: 'Revisión de Emisiones' },
] as const;

type DocumentField = (typeof DOCUMENT_FIELDS)[number]['field'];

@Injectable()
export class TruckExpiryService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ReportNotificationsGateway,
  ) {}

  onModuleInit() {
    // Delay de 5s para que los clientes WebSocket tengan tiempo de reconectarse
    // antes de emitir las notificaciones al arrancar el servidor
    setTimeout(() => void this.checkExpiries(), 5_000);
  }

  // Corre a las 00:00 hora Santiago todos los días (maneja DST de Chile automáticamente)
  @Cron('0 0 * * *', { timeZone: 'America/Santiago' })
  async checkExpiries(): Promise<void> {
    const payloads = await this.getExpiryNotificationPayloads();
    for (const payload of payloads) {
      this.gateway.emitTruckExpiryToAdmins(payload);
    }
  }

  async getExpiryNotificationPayloads(): Promise<TruckExpiryPayload[]> {
    const todayStr = this.getTodayInSantiago();
    const sevenDaysStr = this.addDays(todayStr, 7);
    const oneDayStr = this.addDays(todayStr, 1);

    const targetDates = [sevenDaysStr, oneDayStr];

    const trucks = await this.prisma.truck.findMany({
      where: {
        OR: DOCUMENT_FIELDS.flatMap(({ field }) =>
          targetDates.map((date) => ({
            [field]: new Date(`${date}T00:00:00.000Z`),
          })),
        ),
      },
      select: {
        id: true,
        plate: true,
        technicalReviewExpiresAt: true,
        circulationPermitExpiresAt: true,
        insuranceExpiresAt: true,
        emissionsExpiresAt: true,
      },
    });

    const payloads: TruckExpiryPayload[] = [];

    for (const truck of trucks) {
      for (const { field, label } of DOCUMENT_FIELDS) {
        const expiryDate = truck[field as DocumentField] as Date | null;
        if (!expiryDate) continue;

        const expiryStr = this.toDateString(expiryDate);
        if (expiryStr !== sevenDaysStr && expiryStr !== oneDayStr) continue;

        const daysUntilExpiry: 7 | 1 = expiryStr === sevenDaysStr ? 7 : 1;

        payloads.push({
          notificationId: `truck-expiry-${truck.id}-${field}-${daysUntilExpiry}d-${expiryStr}`,
          truckId: truck.id,
          plate: truck.plate,
          documentType: field,
          documentLabel: label,
          expiresAt: expiryStr,
          daysUntilExpiry,
        });
      }
    }

    return payloads;
  }

  // Devuelve la fecha actual en zona horaria America/Santiago como "YYYY-MM-DD"
  // Usa la API Intl nativa — no requiere dependencias externas y respeta DST
  private getTodayInSantiago(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  // Suma N días a una fecha "YYYY-MM-DD" y devuelve el resultado en el mismo formato
  private addDays(dateStr: string, days: number): string {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return this.toDateString(date);
  }

  // Convierte un objeto Date (almacenado como midnight UTC por @db.Date de Prisma) a "YYYY-MM-DD"
  private toDateString(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
}
