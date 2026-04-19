import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { S3Service } from '../common/s3.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProblemReportDto } from './dto/create-problem-report.dto';
import type { ProblemReportStatusValue } from './dto/update-problem-report-status.dto';

type UploadedImageFile = {
  buffer: Buffer;
  size: number;
  mimetype: string;
};

@Injectable()
export class ReportService {
  private readonly maxUploadBytes = 5 * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
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
      },
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
      },
    });

    return this.attachScreenshotUrls(reports);
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
      },
    });

    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }

    const screenshotUrl = report.screenshotKey
      ? await this.s3Service.getSignedGetUrl(report.screenshotKey).catch(() => null)
      : null;

    return { ...report, screenshotUrl };
  }

  async updateStatus(id: number, status: ProblemReportStatusValue) {
    const existing = await this.prisma.problemReport.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Reporte no encontrado');
    }

    return this.prisma.problemReport.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });
  }
}
