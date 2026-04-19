import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProblemReportEventType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { S3Service } from '../common/s3.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProblemReportDto } from './dto/create-problem-report.dto';
import { RespondProblemReportDto } from './dto/respond-problem-report.dto';
import type { ProblemReportStatusValue } from './dto/update-problem-report-status.dto';
import { ReportNotificationsGateway } from './report-notifications.gateway';

type UploadedImageFile = {
  buffer: Buffer;
  size: number;
  mimetype: string;
};

@Injectable()
export class ReportService {
  private readonly maxUploadBytes = 5 * 1024 * 1024;
  private readonly notificationTtlMs = 3 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly reportNotificationsGateway: ReportNotificationsGateway,
  ) {}

  private getExtensionFromMimeType(mimeType: string): string {
    switch ((mimeType || '').toLowerCase()) {
      case 'image/png':
        return 'png';
      case 'image/jpeg':
      case 'image/jpg':
        return 'jpg';
      case 'image/webp':
        return 'webp';
      default:
        throw new BadRequestException(
          'Solo se permiten imagenes PNG, JPEG o WEBP.',
        );
    }
  }

  private buildScreenshotKey(mimeType: string): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const extension = this.getExtensionFromMimeType(mimeType);

    return `reports/${year}/${month}/${randomUUID()}.${extension}`;
  }

  private isWithinNotificationWindow(date: Date | string | null | undefined): boolean {
    if (!date) {
      return false;
    }

    const createdAt = new Date(date).getTime();
    if (Number.isNaN(createdAt)) {
      return false;
    }

    return Date.now() - createdAt < this.notificationTtlMs;
  }

  async create(
    reporterId: number,
    dto: CreateProblemReportDto,
    file?: UploadedImageFile,
  ) {
    const reporter = await this.prisma.user.findUnique({
      where: { id: reporterId },
      select: { id: true },
    });

    if (!reporter) {
      throw new NotFoundException('Usuario reportante no encontrado');
    }

    let screenshotKey: string | null = null;

    if (file) {
      if (file.size > this.maxUploadBytes) {
        throw new BadRequestException(
          'La captura no puede superar 5 MB.',
        );
      }

      screenshotKey = this.buildScreenshotKey(file.mimetype);
      await this.s3Service.uploadImageBuffer({
        buffer: file.buffer,
        contentType: file.mimetype,
        key: screenshotKey,
      });
    }

    const report = await this.prisma.problemReport.create({
      data: {
        title: dto.title,
        description: dto.description,
        screenshotKey,
        reporterId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        screenshotKey: true,
        status: true,
        reporterId: true,
        createdAt: true,
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await this.prisma.problemReportTimeline.create({
      data: {
        reportId: report.id,
        actorId: reporterId,
        eventType: ProblemReportEventType.CREATED,
        previousStatus: report.status,
        newStatus: report.status,
      },
    });

    this.reportNotificationsGateway.emitReportCreatedToAdmins({
      reportId: report.id,
      title: report.title,
      description: report.description,
      status: report.status,
      createdAt: report.createdAt,
      reporter: report.reporter,
    });

    const screenshotUrl = report.screenshotKey
      ? await this.s3Service.getSignedGetUrl(report.screenshotKey).catch(() => null)
      : null;

    return {
      ...report,
      screenshotUrl,
    };
  }

  private async attachScreenshotUrls<T extends { screenshotKey: string | null }>(
    reports: T[],
  ): Promise<(T & { screenshotUrl: string | null })[]> {
    return Promise.all(
      reports.map(async (report) => ({
        ...report,
        screenshotUrl: report.screenshotKey
          ? await this.s3Service
              .getSignedGetUrl(report.screenshotKey)
              .catch(() => null)
          : null,
      })),
    );
  }

  async findMine(reporterId: number) {
    const reports = await this.prisma.problemReport.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        screenshotKey: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        timeline: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            eventType: true,
            previousStatus: true,
            newStatus: true,
            note: true,
            createdAt: true,
            actor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    const filteredReports = reports.map((report) => ({
      ...report,
      timeline: report.timeline.filter((entry) =>
        this.isWithinNotificationWindow(entry.createdAt),
      ),
    }));

    return this.attachScreenshotUrls(filteredReports);
  }

  async findAll() {
    const reports = await this.prisma.problemReport.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        screenshotKey: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return this.attachScreenshotUrls(reports);
  }

  async findOne(id: number) {
    const report = await this.prisma.problemReport.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        screenshotKey: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        timeline: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            eventType: true,
            previousStatus: true,
            newStatus: true,
            note: true,
            createdAt: true,
            actor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }

    const screenshotUrl = report.screenshotKey
      ? await this.s3Service.getSignedGetUrl(report.screenshotKey).catch(() => null)
      : null;

    return {
      ...report,
      timeline: report.timeline.filter((entry) =>
        this.isWithinNotificationWindow(entry.createdAt),
      ),
      screenshotUrl,
    };
  }

  async findTimeline(id: number) {
    const report = await this.prisma.problemReport.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }

    const timeline = await this.prisma.problemReportTimeline.findMany({
      where: { reportId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        eventType: true,
        previousStatus: true,
        newStatus: true,
        note: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return timeline;
  }

  async respondToReport(
    id: number,
    actorId: number,
    dto: RespondProblemReportDto,
  ) {
    const existing = await this.prisma.problemReport.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        reporterId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Reporte no encontrado');
    }

    const normalizedNote = dto.note?.trim() || null;
    const nextStatus = dto.status ?? existing.status;

    if (nextStatus === existing.status && !normalizedNote) {
      throw new BadRequestException(
        'Debes enviar una nota o cambiar el estado del reporte.',
      );
    }

    const eventType =
      normalizedNote && nextStatus !== existing.status
        ? ProblemReportEventType.NOTE_AND_STATUS_CHANGED
        : normalizedNote
          ? ProblemReportEventType.NOTE_ADDED
          : ProblemReportEventType.STATUS_CHANGED;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedReport =
        nextStatus !== existing.status
          ? await tx.problemReport.update({
              where: { id },
              data: { status: nextStatus },
              select: {
                id: true,
                title: true,
                status: true,
                reporterId: true,
                updatedAt: true,
              },
            })
          : await tx.problemReport.update({
              where: { id },
              data: { updatedAt: new Date() },
              select: {
                id: true,
                title: true,
                status: true,
                reporterId: true,
                updatedAt: true,
              },
            });

      const timelineEntry = await tx.problemReportTimeline.create({
        data: {
          reportId: id,
          actorId,
          eventType,
          previousStatus: existing.status,
          newStatus: nextStatus,
          note: normalizedNote,
        },
        select: {
          id: true,
          eventType: true,
          previousStatus: true,
          newStatus: true,
          note: true,
          createdAt: true,
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return { updatedReport, timelineEntry };
    });

    this.reportNotificationsGateway.emitReportUpdatedToUser(existing.reporterId, {
      reportId: existing.id,
      title: existing.title,
      timelineEntryId: result.timelineEntry.id,
      previousStatus: existing.status,
      status: result.updatedReport.status,
      note: normalizedNote,
      eventType,
      updatedAt: result.updatedReport.updatedAt,
    });

    return {
      ...result.updatedReport,
      timelineEntry: result.timelineEntry,
    };
  }

  async updateStatus(
    id: number,
    actorId: number,
    status: ProblemReportStatusValue,
  ) {
    return this.respondToReport(id, actorId, { status });
  }

}
