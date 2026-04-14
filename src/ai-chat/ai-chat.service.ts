import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Groq } from 'groq-sdk';
import type { Prisma } from '@prisma/client';
import {
  PlateChangeReason,
  ProblemReportStatus,
  TripHistoryStatus,
  TruckStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AskAiDto } from './dto/ask-ai.dto';

type AllowedEntity =
  | 'users'
  | 'trucks'
  | 'destinations'
  | 'patients'
  | 'tripHistories'
  | 'vehicleMaintenanceRecords'
  | 'maintenanceItems'
  | 'problemReports'
  | 'occupations'
  | 'truckPlateChangeLogs'
  | 'truckAssignments';

type AllowedOperation = 'list' | 'count' | 'getById';
type FilterOperator =
  | 'equals'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'notNull'
  | 'isNull';

type QueryFilter = {
  field: string;
  operator: FilterOperator;
  value: unknown;
};

type QueryOrderBy = {
  field: string;
  direction: 'asc' | 'desc';
};

type RelationFilter = {
  relation: string;
  operator: 'some' | 'none' | 'every';
  where?: QueryFilter[];
  nested?: {
    relation: string;
    operator: 'some' | 'none' | 'every';
    where?: QueryFilter[];
  };
};

type QueryPlanItem = {
  entity: AllowedEntity;
  operation: AllowedOperation;
  id?: number;
  limit?: number;
  where?: QueryFilter[];
  whereOr?: QueryFilter[][];  // array of filter groups joined with OR
  relationFilters?: RelationFilter[];
  orderBy?: QueryOrderBy;
  select?: string[];
  include?: string[];
};

type QueryPlan = {
  intent: string;
  queries: QueryPlanItem[];
};

type EntityConfig = {
  fields: string[];
  defaultSelect: string[];
};

const ENTITY_CONFIG: Record<AllowedEntity, EntityConfig> = {
  users: {
    fields: ['id', 'email', 'phone', 'name', 'createdAt', 'role', 'occupationId', 'isVerified'],
    defaultSelect: ['id', 'email', 'name', 'role', 'isVerified', 'createdAt'],
  },
  trucks: {
    fields: [
      'id',
      'plate',
      'brand',
      'model',
      'year',
      'seatCount',
      'mileage',
      'status',
      'technicalReviewExpiresAt',
      'circulationPermitExpiresAt',
      'insuranceExpiresAt',
      'emissionsExpiresAt',
    ],
    defaultSelect: ['id', 'plate', 'brand', 'model', 'mileage', 'status'],
  },
  destinations: {
    fields: ['id', 'name', 'active', 'createdAt'],
    defaultSelect: ['id', 'name', 'active'],
  },
  patients: {
    fields: ['id', 'name', 'destinationId'],
    defaultSelect: ['id', 'name', 'destinationId'],
  },
  tripHistories: {
    fields: [
      'id',
      'date',
      'startTime',
      'endTime',
      'status',
      'startKm',
      'endKm',
      'signatureKey',
      'truckId',
      'destinationId',
      'employeeId',
      'patientId',
      'createdAt',
    ],
    defaultSelect: [
      'id',
      'date',
      'status',
      'truckId',
      'destinationId',
      'employeeId',
      'patientId',
      'startKm',
      'endKm',
    ],
  },
  vehicleMaintenanceRecords: {
    fields: [
      'id',
      'truckId',
      'driverId',
      'inspectionDate',
      'inspectionTime',
      'municipalLicense',
      'currentMileage',
      'createdAt',
      'updatedAt',
    ],
    defaultSelect: [
      'id',
      'truckId',
      'driverId',
      'inspectionDate',
      'inspectionTime',
      'currentMileage',
      'createdAt',
    ],
  },
  maintenanceItems: {
    fields: ['id', 'recordId', 'itemCode', 'itemName', 'category', 'exists', 'status', 'notes'],
    defaultSelect: ['id', 'recordId', 'itemCode', 'itemName', 'category', 'exists', 'status'],
  },
  problemReports: {
    fields: ['id', 'title', 'description', 'screenshotKey', 'status', 'reporterId', 'createdAt', 'updatedAt'],
    defaultSelect: ['id', 'title', 'status', 'reporterId', 'createdAt'],
  },
  occupations: {
    fields: ['id', 'name'],
    defaultSelect: ['id', 'name'],
  },
  truckPlateChangeLogs: {
    fields: [
      'id',
      'truckId',
      'changedByUserId',
      'reason',
      'observations',
      'previousStatus',
      'newStatus',
      'createdAt',
    ],
    defaultSelect: ['id', 'truckId', 'changedByUserId', 'reason', 'newStatus', 'createdAt'],
  },
  truckAssignments: {
    fields: ['userId', 'truckId'],
    defaultSelect: ['userId', 'truckId'],
  },
};

// Maps each entity to the relation names it is allowed to include
const ENTITY_ALLOWED_INCLUDES: Partial<Record<AllowedEntity, string[]>> = {
  vehicleMaintenanceRecords: ['maintenanceItems'],
  trucks: ['vehicleMaintenanceRecords', 'tripHistories', 'users'],
  tripHistories: ['points'],
  users: ['occupation', 'trucks'],
  destinations: ['patients'],
};

// When including a relation, automatically also include these nested relations
// so the LLM gets complete data without having to ask for deep nesting
const ENTITY_AUTO_NESTED_INCLUDES: Partial<Record<AllowedEntity, Record<string, object>>> = {
  trucks: {
    vehicleMaintenanceRecords: { include: { maintenanceItems: true } },
    // TruckAssignment is a junction table — auto-include the actual User details
    users: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
  },
  users: {
    // TruckAssignment is a junction table — auto-include the actual Truck details
    trucks: { include: { truck: { select: { id: true, plate: true, brand: true, model: true } } } },
  },
};


// Default includes applied to all list/getById operations so the answer LLM
// receives names/plates instead of raw foreign-key IDs.
const ENTITY_DEFAULT_LIST_INCLUDES: Partial<Record<AllowedEntity, object>> = {
  tripHistories: {
    truck: { select: { id: true, plate: true } },
    employee: { select: { id: true, name: true } },
    destination: { select: { id: true, name: true } },
    patient: { select: { id: true, name: true } },
  },
  vehicleMaintenanceRecords: {
    truck: { select: { id: true, plate: true } },
    driver: { select: { id: true, name: true } },
  },
  problemReports: {
    reporter: { select: { id: true, name: true } },
  },
  truckPlateChangeLogs: {
    truck: { select: { id: true, plate: true } },
    changedBy: { select: { id: true, name: true } },
  },
  patients: {
    destination: { select: { id: true, name: true } },
  },
};

// Defines allowed relation paths for relationFilters (Prisma some/none/every)
type RelationPath = {
  relation: string;
  entity: AllowedEntity;
  nested?: Array<{ relation: string; entity: AllowedEntity }>;
};
const ENTITY_ALLOWED_RELATION_FILTERS: Partial<Record<AllowedEntity, RelationPath[]>> = {
  trucks: [
    {
      relation: 'vehicleMaintenanceRecords',
      entity: 'vehicleMaintenanceRecords',
      nested: [{ relation: 'maintenanceItems', entity: 'maintenanceItems' }],
    },
    { relation: 'tripHistories', entity: 'tripHistories' },
    { relation: 'plateChangeLogs', entity: 'truckPlateChangeLogs' },
    { relation: 'truckPlateChangeLogs', entity: 'truckPlateChangeLogs' }, // alias usado por el LLM
    { relation: 'users', entity: 'users' },
  ],
  vehicleMaintenanceRecords: [
    { relation: 'maintenanceItems', entity: 'maintenanceItems' },
  ],
  users: [
    { relation: 'tripHistories', entity: 'tripHistories' },
    { relation: 'vehicleMaintenanceRecords', entity: 'vehicleMaintenanceRecords' },
    { relation: 'problemReports', entity: 'problemReports' },
    { relation: 'trucks', entity: 'trucks' },
  ],
  destinations: [
    { relation: 'patients', entity: 'patients' },
    { relation: 'tripHistories', entity: 'tripHistories' },
  ],
};

const MAINTENANCE_ITEM_STATUS_MAP: Record<string, string> = {
  bueno: 'Bueno',
  regular: 'Regular',
  malo: 'Malo',
  good: 'Bueno',
  bad: 'Malo',
  ok: 'Bueno',
};

const MAINTENANCE_ITEM_EXISTS_MAP: Record<string, string> = {
  si: 'Si',
  sí: 'Si',
  yes: 'Si',
  no: 'No',
};

const MAX_QUERY_ITEMS = 3;
const MAX_LIMIT_PER_QUERY = 50;
const DEFAULT_MAX_RETRIES_PER_MODEL = 2;

const TRIP_STATUS_MAP: Record<string, TripHistoryStatus> = {
  driver_filling: TripHistoryStatus.DRIVER_FILLING,
  driverfilling: TripHistoryStatus.DRIVER_FILLING,
  filling: TripHistoryStatus.DRIVER_FILLING,
  employee_signed: TripHistoryStatus.EMPLOYEE_SIGNED,
  employeesigned: TripHistoryStatus.EMPLOYEE_SIGNED,
  signed: TripHistoryStatus.EMPLOYEE_SIGNED,
  completed: TripHistoryStatus.COMPLETED,
};

const TRUCK_STATUS_MAP: Record<string, TruckStatus> = {
  active: TruckStatus.ACTIVE,
  inactive: TruckStatus.INACTIVE,
};

const REPORT_STATUS_MAP: Record<string, ProblemReportStatus> = {
  open: ProblemReportStatus.OPEN,
  in_review: ProblemReportStatus.IN_REVIEW,
  inreview: ProblemReportStatus.IN_REVIEW,
  review: ProblemReportStatus.IN_REVIEW,
  resolved: ProblemReportStatus.RESOLVED,
};

const ROLE_MAP: Record<string, UserRole> = {
  admin: UserRole.ADMIN,
  driver: UserRole.DRIVER,
  employee: UserRole.EMPLOYEE,
  dispatcher: UserRole.EMPLOYEE,
  dispatch: UserRole.EMPLOYEE,
  funcionario: UserRole.EMPLOYEE,
};

const PLATE_REASON_MAP: Record<string, PlateChangeReason> = {
  logistica: PlateChangeReason.LOGISTICA,
  averia: PlateChangeReason.AVERIA,
};

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private readonly model = process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
  private readonly fallbackModels = (process.env.GROQ_FALLBACK_MODELS || '')
    .split(',')
    .map((model) => model.trim())
    .filter((model) => model.length > 0);
  private readonly maxRetriesPerModel = Math.max(
    Number(process.env.GROQ_MAX_RETRIES_PER_MODEL ?? DEFAULT_MAX_RETRIES_PER_MODEL),
    1,
  );

  constructor(private readonly prisma: PrismaService) {}

  async ask(userId: number, dto: AskAiDto) {
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      throw new ServiceUnavailableException(
        'Falta configurar GROQ_API_KEY en el entorno del backend.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true },
    });

    if (!user) {
      throw new BadRequestException('Usuario autenticado no encontrado.');
    }

    const groq = new Groq({ apiKey: groqApiKey });
    const limitHint = dto.limit ?? 10;

    try {
      const directResponse = await this.tryHandleDirectQuery(dto.message, limitHint);
      if (directResponse) {
        return directResponse;
      }

      const plan = await this.buildPlan(groq, dto.message, limitHint, user.role);
      const execution = await this.executePlan(plan);
      const answer = await this.generateAnswer(groq, dto.message, execution);

      return {
        answer,
        intent: plan.intent,
        executedQueries: execution,
      };
    } catch (error) {
      this.logger.error(
        `Error procesando consulta IA. userId=${userId}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      const message = this.buildGroqErrorMessage(error);
      throw new ServiceUnavailableException(
        message ||
          'No fue posible procesar la consulta en este momento. Intenta nuevamente en unos segundos.',
      );
    }
  }

  private async tryHandleDirectQuery(
    message: string,
    limitHint: number,
  ): Promise<{
    answer: string;
    intent: string;
    executedQueries: Array<{ query: QueryPlanItem; result: unknown }>;
  } | null> {
    // Only keep groupBy queries here — Prisma AI plan can't express GROUP BY.
    // Everything else is handled by the LLM pipeline which gives richer, adaptive answers.
    if (this.isUsersByRoleQuery(message)) {
      return this.handleUsersByRoleQuery();
    }

    // @db.Date range comparisons via LLM pipeline are unreliable — handle directly with native Date objects.
    if (this.isExpiredDocumentQuery(message)) {
      return this.handleExpiredDocumentQuery(limitHint);
    }

    return null;
  }

  private isExpiredDocumentQuery(message: string): boolean {
    const normalized = this.normalizeMessage(message);
    return (
      (normalized.includes('vencid') || normalized.includes('expirad')) &&
      (normalized.includes('inspeccion') || normalized.includes('revision') ||
        normalized.includes('permiso') || normalized.includes('seguro') ||
        normalized.includes('emision') || normalized.includes('documento') ||
        normalized.includes('camion') || normalized.includes('vehiculo'))
    );
  }

  private async handleExpiredDocumentQuery(limitHint: number): Promise<{
    answer: string;
    intent: string;
    executedQueries: Array<{ query: QueryPlanItem; result: unknown }>;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = Math.min(Math.max(limitHint, 1), MAX_LIMIT_PER_QUERY);

    const trucks = await this.prisma.truck.findMany({
      where: {
        OR: [
          { technicalReviewExpiresAt: { lt: today } },
          { circulationPermitExpiresAt: { lt: today } },
          { insuranceExpiresAt: { lt: today } },
          { emissionsExpiresAt: { lt: today } },
        ],
      },
      select: {
        id: true,
        plate: true,
        brand: true,
        model: true,
        technicalReviewExpiresAt: true,
        circulationPermitExpiresAt: true,
        insuranceExpiresAt: true,
        emissionsExpiresAt: true,
      },
      take: limit,
      orderBy: { id: 'asc' },
    });

    const todayStr = today.toISOString().slice(0, 10);

    let answer: string;
    if (trucks.length === 0) {
      answer = 'No se encontraron vehículos con documentos vencidos.';
    } else {
      const lines = trucks.map((t) => {
        const expired: string[] = [];
        if (t.technicalReviewExpiresAt && t.technicalReviewExpiresAt < today)
          expired.push(`revisión técnica (${t.technicalReviewExpiresAt.toISOString().slice(0, 10)})`);
        if (t.circulationPermitExpiresAt && t.circulationPermitExpiresAt < today)
          expired.push(`permiso circulación (${t.circulationPermitExpiresAt.toISOString().slice(0, 10)})`);
        if (t.insuranceExpiresAt && t.insuranceExpiresAt < today)
          expired.push(`seguro (${t.insuranceExpiresAt.toISOString().slice(0, 10)})`);
        if (t.emissionsExpiresAt && t.emissionsExpiresAt < today)
          expired.push(`emisiones (${t.emissionsExpiresAt.toISOString().slice(0, 10)})`);
        return `- ${t.plate} | ${t.brand ?? ''} ${t.model} → vencido: ${expired.join(', ')}`;
      });
      answer = `Se encontraron ${trucks.length} vehículo(s) con documentos vencidos (al ${todayStr}):\n\n${lines.join('\n')}`;
    }

    return {
      answer,
      intent: 'vehículos con documentos vencidos',
      executedQueries: [{ query: { entity: 'trucks', operation: 'list', limit }, result: trucks }],
    };
  }

  private async handleUsersByRoleQuery(): Promise<{
    answer: string;
    intent: string;
    executedQueries: Array<{ query: QueryPlanItem; result: unknown }>;
  }> {
    const counts = await this.prisma.user.groupBy({
      by: ['role'],
      _count: {
        _all: true,
      },
    });

    const roleOrder: UserRole[] = [UserRole.ADMIN, UserRole.DRIVER, UserRole.EMPLOYEE];
    const countsByRole = roleOrder.map((role) => ({
      role,
      count: counts.find((item) => item.role === role)?._count._all ?? 0,
    }));

    const total = countsByRole.reduce((sum, item) => sum + item.count, 0);
    const answer = [
      `Hay ${total} usuarios en total.`,
      ...countsByRole.map((item) => `- ${item.role}: ${item.count}`),
    ].join('\n');

    return {
      answer,
      intent: 'conteo de usuarios por rol',
      executedQueries: [
        {
          query: {
            entity: 'users',
            operation: 'count',
            select: ['role'],
          },
          result: countsByRole,
        },
      ],
    };
  }

  private async handleTotalUsersQuery(): Promise<{
    answer: string;
    intent: string;
    executedQueries: Array<{ query: QueryPlanItem; result: unknown }>;
  }> {
    const total = await this.prisma.user.count();

    return {
      answer: `Hay ${total} usuarios en total.`,
      intent: 'conteo total de usuarios',
      executedQueries: [
        {
          query: {
            entity: 'users',
            operation: 'count',
          },
          result: { total },
        },
      ],
    };
  }

  private async handleTruckStatusCountQuery(message: string): Promise<{
    answer: string;
    intent: string;
    executedQueries: Array<{ query: QueryPlanItem; result: unknown }>;
  }> {
    const normalized = this.normalizeMessage(message);
    const status = normalized.includes('inactivo') ? TruckStatus.INACTIVE : TruckStatus.ACTIVE;
    const total = await this.prisma.truck.count({ where: { status } });

    return {
      answer: `Hay ${total} camiones ${status === TruckStatus.ACTIVE ? 'activos' : 'inactivos'}.`,
      intent: 'conteo de camiones por estado',
      executedQueries: [
        {
          query: {
            entity: 'trucks',
            operation: 'count',
            select: ['status'],
          },
          result: { status, total },
        },
      ],
    };
  }

  private async handleTrucksListQuery(message: string, limitHint: number): Promise<{
    answer: string;
    intent: string;
    executedQueries: Array<{ query: QueryPlanItem; result: unknown }>;
  }> {
    const limit = this.extractLimitFromMessage(message, limitHint);
    const trucks = await this.prisma.truck.findMany({
      orderBy: { id: 'asc' },
      take: limit,
      select: {
        id: true,
        plate: true,
        brand: true,
        model: true,
        mileage: true,
        status: true,
      },
    });

    const answer = trucks.length === 0
      ? 'No encontré camiones registrados.'
      : `Encontré ${trucks.length} camiones:\n${trucks
          .map((truck) => `- ${truck.id}: ${truck.plate} | ${truck.brand ?? 'Sin marca'} ${truck.model} | ${truck.status}`)
          .join('\n')}`;

    return {
      answer,
      intent: 'listado de camiones',
      executedQueries: [
        {
          query: {
            entity: 'trucks',
            operation: 'list',
            limit,
            select: ['id', 'plate', 'brand', 'model', 'mileage', 'status'],
          },
          result: trucks,
        },
      ],
    };
  }

  private async handleRecentTripsQuery(limitHint: number): Promise<{
    answer: string;
    intent: string;
    executedQueries: Array<{ query: QueryPlanItem; result: unknown }>;
  }> {
    const limit = Math.min(Math.max(limitHint, 1), MAX_LIMIT_PER_QUERY);
    const trips = await this.prisma.tripHistory.findMany({
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        date: true,
        status: true,
        startTime: true,
        endTime: true,
        truck: { select: { plate: true } },
        destination: { select: { name: true } },
        employee: { select: { name: true, email: true } },
      },
    });

    const answer = trips.length === 0
      ? 'No encontré viajes registrados.'
      : `Encontré ${trips.length} viajes recientes.`;

    return {
      answer,
      intent: 'listado de viajes recientes',
      executedQueries: [
        {
          query: {
            entity: 'tripHistories',
            operation: 'list',
            limit,
            select: ['id', 'date', 'status', 'startTime', 'endTime', 'truckId', 'destinationId', 'employeeId'],
          },
          result: trips,
        },
      ],
    };
  }

  private async handleOpenReportsQuery(limitHint: number): Promise<{
    answer: string;
    intent: string;
    executedQueries: Array<{ query: QueryPlanItem; result: unknown }>;
  }> {
    const limit = Math.min(Math.max(limitHint, 1), MAX_LIMIT_PER_QUERY);
    const reports = await this.prisma.problemReport.findMany({
      where: { status: ProblemReportStatus.OPEN },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        reporter: { select: { name: true, email: true } },
      },
    });

    const answer = reports.length === 0
      ? 'No encontré reportes abiertos.'
      : `Encontré ${reports.length} reportes abiertos.`;

    return {
      answer,
      intent: 'listado de reportes abiertos',
      executedQueries: [
        {
          query: {
            entity: 'problemReports',
            operation: 'list',
            limit,
            select: ['id', 'title', 'status', 'createdAt', 'reporterId'],
          },
          result: reports,
        },
      ],
    };
  }

  private async handleDailyRegistrationTrucksQuery(limitHint: number): Promise<{
    answer: string;
    intent: string;
    executedQueries: Array<{ query: QueryPlanItem; result: unknown }>;
  }> {
    const limit = Math.min(Math.max(limitHint, 1), MAX_LIMIT_PER_QUERY);

    const grouped = await this.prisma.tripHistory.groupBy({
      by: ['truckId'],
      _count: {
        _all: true,
      },
      _max: {
        date: true,
      },
      orderBy: {
        _count: {
          truckId: 'desc',
        },
      },
      take: limit,
    });

    const truckIds = grouped.map((item) => item.truckId);
    const trucks = truckIds.length > 0
      ? await this.prisma.truck.findMany({
          where: { id: { in: truckIds } },
          select: {
            id: true,
            plate: true,
            brand: true,
            model: true,
          },
        })
      : [];

    const trucksById = new Map(trucks.map((truck) => [truck.id, truck]));

    const items = grouped.map((item) => {
      const truck = trucksById.get(item.truckId);

      return {
        truckId: item.truckId,
        plate: truck?.plate ?? `Camión ${item.truckId}`,
        brand: truck?.brand ?? null,
        model: truck?.model ?? null,
        tripsCount: item._count._all,
        lastRegistrationAt: item._max.date,
      };
    });

    const answer = items.length === 0
      ? 'No encontré camiones con registro diario.'
      : `Encontré ${items.length} camiones que han llenado registro diario:\n${items
          .map((item) => `- ${item.plate} (${item.tripsCount} registros)`)
          .join('\n')}`;

    return {
      answer,
      intent: 'camiones con registro diario',
      executedQueries: [
        {
          query: {
            entity: 'tripHistories',
            operation: 'count',
            select: ['truckId', 'date'],
          },
          result: items,
        },
      ],
    };
  }

  private async handleMaintenanceQuery(limitHint: number): Promise<{
    answer: string;
    intent: string;
    executedQueries: Array<{ query: QueryPlanItem; result: unknown }>;
  }> {
    const limit = Math.min(Math.max(limitHint, 1), MAX_LIMIT_PER_QUERY);
    const records = await this.prisma.vehicleMaintenanceRecord.findMany({
      orderBy: { inspectionDate: 'desc' },
      take: limit,
      select: {
        id: true,
        inspectionDate: true,
        inspectionTime: true,
        currentMileage: true,
        municipalLicense: true,
        truck: {
          select: {
            id: true,
            plate: true,
            model: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const answer = records.length === 0
      ? 'No encontré registros de mantenimiento.'
      : `Encontré ${records.length} registros de mantenimiento.`;

    return {
      answer,
      intent: 'mantenimientos vehiculares recientes',
      executedQueries: [
        {
          query: {
            entity: 'vehicleMaintenanceRecords',
            operation: 'list',
            limit,
            select: ['id', 'inspectionDate', 'inspectionTime', 'currentMileage', 'truckId', 'driverId'],
          },
          result: records,
        },
      ],
    };
  }

  private async handleDestinationsQuery(limitHint: number): Promise<{
    answer: string;
    intent: string;
    executedQueries: Array<{ query: QueryPlanItem; result: unknown }>;
  }> {
    const limit = Math.min(Math.max(limitHint, 1), MAX_LIMIT_PER_QUERY);
    const destinations = await this.prisma.destination.findMany({
      orderBy: { name: 'asc' },
      take: limit,
      select: {
        id: true,
        name: true,
        active: true,
        _count: {
          select: {
            patients: true,
            tripHistories: true,
          },
        },
      },
    });

    const answer = destinations.length === 0
      ? 'No encontré destinos registrados.'
      : `Encontré ${destinations.length} destinos.`;

    return {
      answer,
      intent: 'destinos y volumen asociado',
      executedQueries: [
        {
          query: {
            entity: 'destinations',
            operation: 'list',
            limit,
            select: ['id', 'name', 'active'],
          },
          result: destinations,
        },
      ],
    };
  }

  private async handleReportsStatusQuery(message: string): Promise<{
    answer: string;
    intent: string;
    executedQueries: Array<{ query: QueryPlanItem; result: unknown }>;
  }> {
    const normalized = this.normalizeMessage(message);
    let status: ProblemReportStatus = ProblemReportStatus.OPEN;

    if (normalized.includes('resuelto')) {
      status = ProblemReportStatus.RESOLVED;
    } else if (normalized.includes('revision') || normalized.includes('proceso') || normalized.includes('revis')) {
      status = ProblemReportStatus.IN_REVIEW;
    }

    const total = await this.prisma.problemReport.count({ where: { status } });

    return {
      answer: `Hay ${total} reportes con estado ${status}.`,
      intent: 'conteo de reportes por estado',
      executedQueries: [
        {
          query: {
            entity: 'problemReports',
            operation: 'count',
            select: ['status'],
          },
          result: { status, total },
        },
      ],
    };
  }

  private async handlePlateChangeLogsQuery(limitHint: number): Promise<{
    answer: string;
    intent: string;
    executedQueries: Array<{ query: QueryPlanItem; result: unknown }>;
  }> {
    const limit = Math.min(Math.max(limitHint, 1), MAX_LIMIT_PER_QUERY);
    const logs = await this.prisma.truckPlateChangeLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        reason: true,
        previousStatus: true,
        newStatus: true,
        createdAt: true,
        truck: {
          select: {
            id: true,
            plate: true,
          },
        },
      },
    });

    const answer = logs.length === 0
      ? 'No encontré cambios de patente registrados.'
      : `Encontré ${logs.length} cambios de patente recientes.`;

    return {
      answer,
      intent: 'cambios de patente recientes',
      executedQueries: [
        {
          query: {
            entity: 'truckPlateChangeLogs',
            operation: 'list',
            limit,
            select: ['id', 'reason', 'previousStatus', 'newStatus', 'createdAt', 'truckId'],
          },
          result: logs,
        },
      ],
    };
  }

  private isUsersByRoleQuery(message: string): boolean {
    const normalized = this.normalizeMessage(message);

    return (
      normalized.includes('usuario') &&
      normalized.includes('rol') &&
      (normalized.includes('cuantos') || normalized.includes('cuanta') || normalized.includes('cantidad') || normalized.includes('total'))
    );
  }

  private isTotalUsersQuery(message: string): boolean {
    const normalized = this.normalizeMessage(message);
    return normalized.includes('usuarios') && normalized.includes('total');
  }

  private isTruckStatusCountQuery(message: string): boolean {
    const normalized = this.normalizeMessage(message);
    const hasCountKeyword =
      normalized.includes('cuanto') ||
      normalized.includes('cuanta') ||
      normalized.includes('total') ||
      normalized.includes('cantidad');
    return (
      hasCountKeyword &&
      normalized.includes('camion') &&
      (normalized.includes('activo') || normalized.includes('inactivo'))
    );
  }

  private isTrucksListQuery(message: string): boolean {
    const normalized = this.normalizeMessage(message);
    // Only intercept simple "list all trucks" queries with no extra conditions
    const hasListKeyword =
      normalized.includes('primer') ||
      normalized.includes('lista') ||
      normalized.includes('muest') ||
      normalized.includes('dame');
    const hasCondition =
      normalized.includes('viaj') ||
      normalized.includes('activo') ||
      normalized.includes('inactivo') ||
      normalized.includes('asign') ||
      normalized.includes('conductor') ||
      normalized.includes('hoy') ||
      normalized.includes('ayer') ||
      normalized.includes('con ') ||
      normalized.includes('sin ') ||
      normalized.includes('que ');
    return normalized.includes('camion') && hasListKeyword && !hasCondition;
  }

  private isRecentTripsQuery(message: string): boolean {
    const normalized = this.normalizeMessage(message);
    const hasCondition =
      normalized.includes('activo') ||
      normalized.includes('hoy') ||
      normalized.includes('ayer') ||
      normalized.includes('completado') ||
      normalized.includes('con ') ||
      normalized.includes('que ') ||
      normalized.includes('camion') ||
      normalized.includes('conductor');
    return (
      normalized.includes('viaj') &&
      (normalized.includes('reciente') || normalized.includes('ultim') || normalized.includes('ultimo')) &&
      !hasCondition
    );
  }

  private isOpenReportsQuery(message: string): boolean {
    const normalized = this.normalizeMessage(message);
    return normalized.includes('reporte') && (normalized.includes('abierto') || normalized.includes('open'));
  }

  private isDailyRegistrationTrucksQuery(message: string): boolean {
    const normalized = this.normalizeMessage(message);
    return (
      normalized.includes('registro diario') &&
      (normalized.includes('camion') || normalized.includes('camiones'))
    );
  }

  private isMaintenanceQuery(message: string): boolean {
    const normalized = this.normalizeMessage(message);
    return normalized.includes('mantenim') || normalized.includes('revision vehicular');
  }

  private isDestinationsQuery(message: string): boolean {
    const normalized = this.normalizeMessage(message);
    return (
      normalized.includes('destino') &&
      (normalized.includes('lista') ||
        normalized.includes('dame') ||
        normalized.includes('muest') ||
        normalized.includes('cuales') ||
        normalized.includes('todos') ||
        normalized.includes('existente'))
    );
  }

  private isReportsStatusQuery(message: string): boolean {
    const normalized = this.normalizeMessage(message);
    return normalized.includes('reporte') && (
      normalized.includes('abierto') ||
      normalized.includes('resuelto') ||
      normalized.includes('revision') ||
      normalized.includes('proceso')
    );
  }

  private isPlateChangeLogsQuery(message: string): boolean {
    const normalized = this.normalizeMessage(message);
    // Only intercept when asking about plate *change history*, not general plate info
    return (
      (normalized.includes('patente') || normalized.includes('placa')) &&
      (normalized.includes('cambio') || normalized.includes('historial') || normalized.includes('log') || normalized.includes('registro de cambio'))
    );
  }

  private normalizeMessage(message: string): string {
    return message
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private extractLimitFromMessage(message: string, fallback: number): number {
    const normalized = this.normalizeMessage(message);
    const match = normalized.match(/\b(\d{1,2})\b/);
    if (!match) {
      return Math.min(Math.max(fallback, 1), MAX_LIMIT_PER_QUERY);
    }

    const parsed = Number(match[1]);
    if (Number.isNaN(parsed)) {
      return Math.min(Math.max(fallback, 1), MAX_LIMIT_PER_QUERY);
    }

    return Math.min(Math.max(parsed, 1), MAX_LIMIT_PER_QUERY);
  }

  private async buildPlan(
    groq: Groq,
    message: string,
    limitHint: number,
    userRole: UserRole,
  ): Promise<QueryPlan> {
    const safeLimit = Math.min(Math.max(limitHint, 1), MAX_LIMIT_PER_QUERY);

    const planPrompt = `Eres un planificador de consultas para el sistema "Transportes Flores Vargas".
Tu única tarea es convertir la pregunta del usuario en un plan de consulta JSON.
Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin explicaciones.

ESQUEMA DE BASE DE DATOS:
- users: id(int), email(str), phone(str), name(str), createdAt(datetime), role(enum: EMPLOYEE|DRIVER|ADMIN), occupationId(int), isVerified(bool)
- trucks: id(int), plate(str), brand(str), model(str), year(int), seatCount(int), mileage(float), status(enum: ACTIVE|INACTIVE), technicalReviewExpiresAt(date — revisión técnica), circulationPermitExpiresAt(date — permiso circulación), insuranceExpiresAt(date — seguro), emissionsExpiresAt(date — emisiones). Para "inspección vencida" filtra estas fechas con lt:"hoy"
- destinations: id(int), name(str), active(bool), createdAt(datetime)
- patients: id(int), name(str), destinationId(int)
- tripHistories: id(int), date(datetime), startTime(str), endTime(str), status(enum: DRIVER_FILLING|EMPLOYEE_SIGNED|COMPLETED), startKm(float), endKm(float), signatureKey(str|null — clave S3 de la firma; no-nulo significa que el viaje tiene firma), truckId(int), destinationId(int), employeeId(int), patientId(int), createdAt(datetime)
- vehicleMaintenanceRecords: id(int), truckId(int), driverId(int), inspectionDate(date), inspectionTime(str), municipalLicense(str), currentMileage(float), createdAt(datetime), updatedAt(datetime)
- maintenanceItems: id(int), recordId(int), itemCode(str), itemName(str), category(str), exists(str: "Si"|"No"), status(str: "Bueno"|"Regular"|"Malo"), notes(str)
- problemReports: id(int), title(str), description(str), screenshotKey(str), status(enum: OPEN|IN_REVIEW|RESOLVED), reporterId(int), createdAt(datetime), updatedAt(datetime)
- occupations: id(int), name(str)
- truckPlateChangeLogs: id(int), truckId(int), changedByUserId(int), reason(enum: LOGISTICA|AVERIA), observations(str), previousStatus(enum: ACTIVE|INACTIVE), newStatus(enum: ACTIVE|INACTIVE), createdAt(datetime)
- truckAssignments: userId(int), truckId(int)  ← tabla de asignación directa camión↔usuario (usa esta para saber qué usuarios están asignados a qué camión)

RELACIONES DISPONIBLES (campo "include" — para traer datos relacionados):
- vehicleMaintenanceRecords puede incluir: ["maintenanceItems"]
- trucks puede incluir: ["vehicleMaintenanceRecords","tripHistories","users"]
- tripHistories puede incluir: ["points"]
- users puede incluir: ["occupation","trucks"]
- destinations puede incluir: ["patients"]

FILTROS POR RELACIÓN (campo "relationFilters" — para FILTRAR/CONTAR por condiciones en entidades relacionadas):
Formato: {"relation":"nombre","operator":"some|none|every","where":[...],"nested":{"relation":"nombre","operator":"some|none|every","where":[...]}}
Rutas permitidas:
- trucks → vehicleMaintenanceRecords (nested: maintenanceItems)
- trucks → tripHistories
- trucks → users
- trucks → plateChangeLogs (usa exactamente "plateChangeLogs", no "truckPlateChangeLogs")
- vehicleMaintenanceRecords → maintenanceItems
- users → tripHistories, vehicleMaintenanceRecords, problemReports, trucks
- destinations → patients, tripHistories

FECHAS RELATIVAS PERMITIDAS (se convierten automáticamente a ISO 8601):
- "hoy" o "today" → fecha de hoy
- "ayer" o "yesterday" → fecha de ayer

FORMATO DE RESPUESTA:
{"intent":"descripción breve","queries":[{"entity":"nombre","operation":"list|count|getById","limit":10,"where":[{"field":"campo","operator":"equals|contains|gt|gte|lt|lte|in|notNull|isNull","value":"valor (ignorado para notNull/isNull)"}],"whereOr":[[{"field":"campo","operator":"lt","value":"hoy"}],[{"field":"otro","operator":"lt","value":"hoy"}]],"relationFilters":[{"relation":"nombre","operator":"some|none|every","where":[...],"nested":{"relation":"nombre","operator":"some","where":[...]}}],"orderBy":{"field":"campo","direction":"asc|desc"},"select":["campo1","campo2"],"include":["relacion"]}]}

REGLAS OBLIGATORIAS:
1. Máximo ${MAX_QUERY_ITEMS} queries en el array.
2. Solo usa campos y relaciones que existen EXACTAMENTE en el esquema y rutas de arriba.
3. Para enums usa EXACTAMENTE los valores en mayúsculas (ej: ACTIVE, DRIVER, COMPLETED).
4. Para maintenanceItems.status usa exactamente: "Bueno", "Regular" o "Malo".
5. Para maintenanceItems.exists usa exactamente: "Si" o "No".
6. Para "cuántos/total/cantidad" usa operation "count" (sin limit, select, orderBy, include).
7. Para listas usa operation "list" con limit=${safeLimit} por defecto.
8. Para FILTRAR por condiciones en tablas relacionadas usa "relationFilters".
9. Para MOSTRAR datos de tablas relacionadas en el resultado usa "include".
10. No uses "include" y "select" juntos (son incompatibles).
11. No uses "include" con operation "count".
12. Para fechas usa "hoy"/"today"/"ayer"/"yesterday" o ISO 8601.
13. Rol del usuario solicitante: ${userRole}.
14. Para condiciones OR entre campos distintos usa "whereOr": array de grupos, cada grupo es un array de filtros AND. Ejemplo: whereOr:[[{field:"a",operator:"lt",value:"hoy"}],[{field:"b",operator:"lt",value:"hoy"}]] significa (a < hoy) OR (b < hoy).

EJEMPLOS:
Pregunta: "¿Cuántos camiones hay en total?"
Respuesta: {"intent":"contar total de camiones","queries":[{"entity":"trucks","operation":"count"}]}

Pregunta: "¿Cuántos camiones están activos?"
Respuesta: {"intent":"contar camiones activos","queries":[{"entity":"trucks","operation":"count","where":[{"field":"status","operator":"equals","value":"ACTIVE"}]}]}

Pregunta: "Dame los últimos 5 viajes completados"
Respuesta: {"intent":"listar últimos viajes completados","queries":[{"entity":"tripHistories","operation":"list","limit":5,"where":[{"field":"status","operator":"equals","value":"COMPLETED"}],"orderBy":{"field":"createdAt","direction":"desc"}}]}

Pregunta: "¿Cuántos conductores hay?"
Respuesta: {"intent":"contar conductores","queries":[{"entity":"users","operation":"count","where":[{"field":"role","operator":"equals","value":"DRIVER"}]}]}

Pregunta: "Reportes abiertos y en revisión"
Respuesta: {"intent":"listar reportes abiertos y en revisión","queries":[{"entity":"problemReports","operation":"list","limit":${safeLimit},"where":[{"field":"status","operator":"in","value":["OPEN","IN_REVIEW"]}],"orderBy":{"field":"createdAt","direction":"desc"}}]}

Pregunta: "¿Cuántos usuarios hay por rol?"
Respuesta: {"intent":"contar usuarios por cada rol","queries":[{"entity":"users","operation":"count","where":[{"field":"role","operator":"equals","value":"DRIVER"}]},{"entity":"users","operation":"count","where":[{"field":"role","operator":"equals","value":"EMPLOYEE"}]},{"entity":"users","operation":"count","where":[{"field":"role","operator":"equals","value":"ADMIN"}]}]}

Pregunta: "¿Cuántos vehículos tienen un reporte diario con algún item en mal estado?"
Respuesta: {"intent":"contar camiones con items en mal estado","queries":[{"entity":"trucks","operation":"count","relationFilters":[{"relation":"vehicleMaintenanceRecords","operator":"some","nested":{"relation":"maintenanceItems","operator":"some","where":[{"field":"status","operator":"equals","value":"Malo"}]}}]}]}

Pregunta: "¿Cuántos vehículos tienen items en mal estado o regular hoy?"
Respuesta: {"intent":"contar camiones con items en mal o regular estado hoy","queries":[{"entity":"trucks","operation":"count","relationFilters":[{"relation":"vehicleMaintenanceRecords","operator":"some","where":[{"field":"inspectionDate","operator":"equals","value":"hoy"}],"nested":{"relation":"maintenanceItems","operator":"some","where":[{"field":"status","operator":"in","value":["Malo","Regular"]}]}}]}]}

Pregunta: "Listar registros de mantenimiento de hoy con sus items"
Respuesta: {"intent":"listar mantenimientos de hoy con items","queries":[{"entity":"vehicleMaintenanceRecords","operation":"list","limit":${safeLimit},"where":[{"field":"inspectionDate","operator":"equals","value":"hoy"}],"include":["maintenanceItems"],"orderBy":{"field":"inspectionDate","direction":"desc"}}]}

Pregunta: "¿Qué camiones no tienen ningún viaje completado?"
Respuesta: {"intent":"camiones sin viajes completados","queries":[{"entity":"trucks","operation":"list","limit":${safeLimit},"relationFilters":[{"relation":"tripHistories","operator":"none","where":[{"field":"status","operator":"equals","value":"COMPLETED"}]}]}]}

Pregunta: "¿Hay algún vehículo con alguna inspección vencida?"
Respuesta: {"intent":"camiones con alguna inspección vencida","queries":[{"entity":"trucks","operation":"list","limit":${safeLimit},"whereOr":[[{"field":"technicalReviewExpiresAt","operator":"lt","value":"hoy"}],[{"field":"circulationPermitExpiresAt","operator":"lt","value":"hoy"}],[{"field":"insuranceExpiresAt","operator":"lt","value":"hoy"}],[{"field":"emissionsExpiresAt","operator":"lt","value":"hoy"}]]}]}

Pregunta: "¿Cuántos vehículos tienen el permiso de circulación vencido?"
Respuesta: {"intent":"contar camiones con permiso circulación vencido","queries":[{"entity":"trucks","operation":"count","where":[{"field":"circulationPermitExpiresAt","operator":"lt","value":"hoy"}]}]}

Pregunta: "¿Cuántos viajes tienen firma?"
Respuesta: {"intent":"contar viajes con firma","queries":[{"entity":"tripHistories","operation":"count","where":[{"field":"signatureKey","operator":"notNull","value":null}]}]}

Pregunta: "Dame los viajes sin firma"
Respuesta: {"intent":"listar viajes sin firma","queries":[{"entity":"tripHistories","operation":"list","limit":${safeLimit},"where":[{"field":"signatureKey","operator":"isNull","value":null}],"orderBy":{"field":"createdAt","direction":"desc"}}]}

Pregunta: "¿A qué usuarios están asignados los vehículos?"
Respuesta: {"intent":"camiones con sus usuarios asignados","queries":[{"entity":"trucks","operation":"list","limit":${safeLimit},"include":["users"]}]}

Pregunta: "¿Qué camiones tiene asignado el conductor X?"
Respuesta: {"intent":"camiones asignados a usuarios conductores","queries":[{"entity":"trucks","operation":"list","limit":${safeLimit},"include":["users"],"relationFilters":[{"relation":"users","operator":"some","where":[{"field":"role","operator":"equals","value":"DRIVER"}]}]}]}`;

    const completion = await this.createChatCompletionWithFallback(groq, {
      temperature: 0.1,
      max_completion_tokens: 1500,
      messages: [
        { role: 'system', content: planPrompt },
        { role: 'user', content: message },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new InternalServerErrorException('No se recibió plan de consulta desde Groq.');
    }

    this.logger.log(`Plan raw response: ${raw}`);

    const parsed = this.safeJsonParse<QueryPlan>(raw);
    this.validatePlan(parsed);

    this.logger.debug(`Plan parsed: ${JSON.stringify(parsed)}`);

    return parsed;
  }

  private async generateAnswer(
    groq: Groq,
    userMessage: string,
    execution: Array<{ query: QueryPlanItem; result: unknown }>,
  ): Promise<string> {
    // Include entity + operation context so the LLM knows what each result represents
    const resultsWithContext = execution.map(({ query, result }) => ({
      entity: query.entity,
      operation: query.operation,
      ...(query.where && query.where.length > 0 ? { filters: query.where } : {}),
      ...(query.relationFilters && query.relationFilters.length > 0
        ? { relationFilters: query.relationFilters }
        : {}),
      result,
    }));
    const summaryPayload = JSON.stringify(resultsWithContext);

    const completion = await this.createChatCompletionWithFallback(groq, {
      temperature: 0.2,
      max_completion_tokens: 900,
      messages: [
        {
          role: 'system',
          content:
            'Eres un asistente de datos del sistema "Transportes Flores Vargas". ' +
            'Tu tarea es responder la pregunta del usuario basándote ÚNICAMENTE en los resultados JSON proporcionados. ' +
            'Cada resultado tiene la forma: {"entity":"nombre","operation":"count|list|getById","filters":[...],"result":...}. ' +
            'INSTRUCCIONES POR TIPO DE OPERACIÓN:\n' +
            '- count: result es un número entero. Responde con una oración completa y descriptiva. Ejemplo: "Hay 3 vehículos que tienen al menos un ítem en estado Regular en sus registros de mantenimiento." Nunca respondas solo con el número.\n' +
            '- list: result es un array de objetos. Presenta los registros como una lista con viñetas, usando "- " al inicio de cada ítem y un salto de línea entre cada uno. IMPORTANTE: los objetos incluyen relaciones anidadas (ej: truck.plate, employee.name, destination.name, driver.name, reporter.name). Usa esos valores en lugar de los IDs crudos (truckId, employeeId, etc.). Solo muestra IDs si el usuario los pidió explícitamente o no hay nombre/placa disponible. Si hay datos anidados como maintenanceItems, analízalos y menciona información relevante.\n' +
            '- Si result es 0 o un array vacío, responde con una oración clara: "No se encontraron registros que cumplan esas condiciones."\n' +
            'Responde siempre en español. No pidas más datos al usuario. No inventes información que no esté en los resultados. Sin markdown excesivo (no uses **, ##, etc.).',
        },
        {
          role: 'user',
          content: `Pregunta: ${userMessage}\n\nResultados de la base de datos:\n${summaryPayload}`,
        },
      ],
    });

    return completion.choices[0]?.message?.content?.trim() || 'No fue posible generar una respuesta.';
  }

  private validatePlan(plan: QueryPlan): void {
    if (!plan || typeof plan !== 'object' || !Array.isArray(plan.queries)) {
      throw new BadRequestException('El plan generado por IA no tiene formato válido.');
    }

    if (plan.queries.length === 0) {
      throw new BadRequestException('La IA no generó ninguna consulta ejecutable.');
    }

    if (plan.queries.length > MAX_QUERY_ITEMS) {
      throw new BadRequestException(
        `La IA generó demasiadas consultas. Máximo permitido: ${MAX_QUERY_ITEMS}.`,
      );
    }

    for (const query of plan.queries) {
      if (!ENTITY_CONFIG[query.entity]) {
        throw new BadRequestException(`Entidad no permitida: ${String(query.entity)}`);
      }

      if (!['list', 'count', 'getById'].includes(query.operation)) {
        throw new BadRequestException(`Operación no permitida: ${String(query.operation)}`);
      }

      if (query.limit && (query.limit < 1 || query.limit > MAX_LIMIT_PER_QUERY)) {
        throw new BadRequestException(
          `El límite debe estar entre 1 y ${MAX_LIMIT_PER_QUERY}.`,
        );
      }

      if (query.include && query.include.length > 0) {
        const allowedIncludes = ENTITY_ALLOWED_INCLUDES[query.entity] ?? [];
        for (const rel of query.include) {
          if (!allowedIncludes.includes(rel)) {
            throw new BadRequestException(
              `Relación no permitida para ${query.entity}: "${rel}". Permitidas: ${allowedIncludes.join(', ') || 'ninguna'}.`,
            );
          }
        }
      }

      if (query.relationFilters && query.relationFilters.length > 0) {
        const allowedPaths = ENTITY_ALLOWED_RELATION_FILTERS[query.entity] ?? [];
        for (const rf of query.relationFilters) {
          if (!['some', 'none', 'every'].includes(rf.operator)) {
            throw new BadRequestException(`Operador de relación no válido: "${rf.operator}". Usar: some, none, every.`);
          }
          const path = allowedPaths.find((p) => p.relation === rf.relation);
          if (!path) {
            throw new BadRequestException(
              `Relación no permitida en filtro para ${query.entity}: "${rf.relation}".`,
            );
          }
          if (rf.nested) {
            if (!['some', 'none', 'every'].includes(rf.nested.operator)) {
              throw new BadRequestException(`Operador anidado no válido: "${rf.nested.operator}".`);
            }
            const nestedPath = path.nested?.find((n) => n.relation === rf.nested!.relation);
            if (!nestedPath) {
              throw new BadRequestException(
                `Relación anidada no permitida: "${rf.relation}.${rf.nested.relation}".`,
              );
            }
          }
        }
      }
    }
  }

  private async executePlan(plan: QueryPlan) {
    const executionResults: Array<{ query: QueryPlanItem; result: unknown }> = [];

    for (const query of plan.queries) {
      const result = await this.executeSingleQuery(query);
      executionResults.push({ query, result });
    }

    return executionResults;
  }

  private async executeSingleQuery(query: QueryPlanItem): Promise<unknown> {
    try {
      const config = ENTITY_CONFIG[query.entity];
      const prismaDelegate = this.getPrismaDelegate(query.entity);
      const select = this.buildSelect(config, query.select);
      const directWhere = this.buildWhere(config, query.entity, query.where) as Record<string, unknown> | undefined;
      const orWhere = this.buildWhereOr(config, query.entity, query.whereOr);
      const relWhere = this.buildRelationWhere(query.entity, query.relationFilters);
      const where = this.mergeWhere(this.mergeWhere(directWhere, orWhere), relWhere);
      this.logger.log(`executeSingleQuery [${query.entity}/${query.operation}] where=${JSON.stringify(where)}`);

      if (query.operation === 'count') {
        return prismaDelegate.count({ where });
      }

      if (query.operation === 'getById') {
        if (!query.id || Number.isNaN(Number(query.id))) {
          throw new BadRequestException('La operación getById requiere un id numérico.');
        }

        const defaultIncludes = ENTITY_DEFAULT_LIST_INCLUDES[query.entity];
        return prismaDelegate.findUnique({
          where: { id: Number(query.id) },
          ...(defaultIncludes ? { include: defaultIncludes } : { select }),
        });
      }

      const safeLimit = Math.min(Math.max(query.limit ?? 10, 1), MAX_LIMIT_PER_QUERY);
      const orderBy = this.buildOrderBy(config, query.orderBy);
      const explicitInclude = this.buildInclude(query.entity, query.include);

      // Prefer explicit LLM includes; fall back to default relation includes;
      // only use select when there are no includes (can't mix both in Prisma)
      const defaultIncludes = ENTITY_DEFAULT_LIST_INCLUDES[query.entity];
      const resolvedInclude = explicitInclude ?? defaultIncludes;

      if (resolvedInclude) {
        return prismaDelegate.findMany({
          where,
          include: resolvedInclude,
          orderBy,
          take: safeLimit,
        });
      }

      return prismaDelegate.findMany({
        where,
        select,
        orderBy,
        take: safeLimit,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `executeSingleQuery error [entity=${query.entity} op=${query.operation}]: ${message}`,
      );
      throw new BadRequestException(
        `Error ejecutando consulta sobre "${query.entity}": ${message}`,
      );
    }
  }

  private buildSelect(config: EntityConfig, requested?: string[]) {
    const fields =
      requested && requested.length > 0
        ? requested.filter((field) => config.fields.includes(field))
        : config.defaultSelect;

    const select: Record<string, boolean> = {};
    for (const field of fields) {
      select[field] = true;
    }

    return select;
  }

  private buildWhere(config: EntityConfig, entity: AllowedEntity, filters?: QueryFilter[]) {
    if (!filters || filters.length === 0) {
      return undefined;
    }

    const whereAnd: Array<Record<string, any>> = [];

    for (const filter of filters) {
      if (!config.fields.includes(filter.field)) {
        continue;
      }

      switch (filter.operator) {
        case 'equals':
          {
            const normalized = this.normalizeFieldValue(entity, filter.field, filter.value);
            if (!this.isAllowedEnumValue(entity, filter.field, normalized)) {
              throw new BadRequestException(
                `Valor no permitido para ${entity}.${filter.field}: ${String(filter.value)}`,
              );
            }

            // For datetime values on date-only fields use a day range (gte start, lt next day)
            // so "equals today" matches the full day regardless of stored time component
            if (typeof normalized === 'string' && this.isIsoDatetime(normalized)) {
              const start = new Date(normalized);
              start.setHours(0, 0, 0, 0);
              const end = new Date(start);
              end.setDate(end.getDate() + 1);
              whereAnd.push({
                [filter.field]: { gte: start.toISOString(), lt: end.toISOString() },
              });
            } else {
              whereAnd.push({
                [filter.field]: normalized as Prisma.JsonValue,
              });
            }
          }
          break;
        case 'contains':
          whereAnd.push({
            [filter.field]: {
              contains: String(filter.value ?? ''),
              mode: 'insensitive',
            },
          });
          break;
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte': {
          let rangeVal = this.normalizeFieldValue(entity, filter.field, filter.value);
          // Prisma @db.Date fields require a Date object for range operators —
          // ISO strings work for equals (via day-range) but not for lt/gte comparisons.
          if (typeof rangeVal === 'string' && this.isIsoDatetime(rangeVal)) {
            rangeVal = new Date(rangeVal);
          }
          whereAnd.push({
            [filter.field]: { [filter.operator]: rangeVal as unknown },
          });
          break;
        }
        case 'in':
          {
            const normalizedValues = (Array.isArray(filter.value) ? filter.value : [filter.value]).map((value) =>
              this.normalizeFieldValue(entity, filter.field, value),
            );

            const allowedValues = normalizedValues.filter((value) =>
              this.isAllowedEnumValue(entity, filter.field, value),
            );

            if (normalizedValues.length > 0 && allowedValues.length === 0) {
              throw new BadRequestException(
                `Ningún valor es válido para ${entity}.${filter.field} en operador in`,
              );
            }

          whereAnd.push({
            [filter.field]: {
              in: allowedValues,
            },
          });
          }
          break;
        case 'notNull':
          whereAnd.push({ [filter.field]: { not: null } });
          break;
        case 'isNull':
          whereAnd.push({ [filter.field]: null });
          break;
        default:
          break;
      }
    }

    if (whereAnd.length === 0) {
      return undefined;
    }

    return { AND: whereAnd };
  }

  private buildWhereOr(
    config: EntityConfig,
    entity: AllowedEntity,
    groups?: QueryFilter[][],
  ): Record<string, unknown> | undefined {
    if (!groups || groups.length === 0) return undefined;

    const orClauses = groups
      .map((group) => {
        const clause = this.buildWhere(config, entity, group);
        if (!clause) return undefined;
        // Unwrap single-item AND arrays — { AND: [x] } → x
        // Prisma handles bare conditions inside OR better than nested AND wrappers
        const andItems = (clause as { AND?: unknown[] }).AND;
        if (Array.isArray(andItems) && andItems.length === 1) {
          return andItems[0] as Record<string, unknown>;
        }
        return clause;
      })
      .filter((clause) => clause !== undefined) as Array<Record<string, unknown>>;

    if (orClauses.length === 0) return undefined;
    return { OR: orClauses };
  }

  private buildOrderBy(config: EntityConfig, requested?: QueryOrderBy) {
    if (!requested) {
      return { id: 'asc' as const };
    }

    if (!config.fields.includes(requested.field)) {
      return { id: 'asc' as const };
    }

    const direction = requested.direction === 'desc' ? 'desc' : 'asc';
    return { [requested.field]: direction };
  }

  private buildInclude(entity: AllowedEntity, relations?: string[]): Record<string, unknown> | undefined {
    if (!relations || relations.length === 0) {
      return undefined;
    }

    const allowedIncludes = ENTITY_ALLOWED_INCLUDES[entity] ?? [];
    const autoNested = ENTITY_AUTO_NESTED_INCLUDES[entity] ?? {};
    const include: Record<string, unknown> = {};

    for (const rel of relations) {
      if (!allowedIncludes.includes(rel)) continue;
      // Use auto-nested config if available, otherwise just true
      include[rel] = autoNested[rel] ?? true;
    }

    return Object.keys(include).length > 0 ? include : undefined;
  }

  private buildRelationWhere(
    entity: AllowedEntity,
    relationFilters?: RelationFilter[],
  ): Record<string, unknown> | undefined {
    if (!relationFilters || relationFilters.length === 0) {
      return undefined;
    }

    const allowedPaths = ENTITY_ALLOWED_RELATION_FILTERS[entity] ?? [];
    const result: Record<string, unknown> = {};

    // Relation name aliases: LLM may use the entity name instead of the Prisma field name
    const RELATION_ALIASES: Record<string, string> = {
      truckPlateChangeLogs: 'plateChangeLogs',
    };

    for (const rf of relationFilters) {
      const path = allowedPaths.find((p) => p.relation === rf.relation);
      if (!path) continue;

      // Use the real Prisma field name (resolving alias if needed)
      const prismaRelationName = RELATION_ALIASES[rf.relation] ?? rf.relation;

      const relatedConfig = ENTITY_CONFIG[path.entity];
      const relatedWhere = this.buildWhere(relatedConfig, path.entity, rf.where);

      if (rf.nested) {
        const nestedPath = path.nested?.find((n) => n.relation === rf.nested!.relation);
        if (nestedPath) {
          const nestedConfig = ENTITY_CONFIG[nestedPath.entity];
          const nestedWhere = this.buildWhere(nestedConfig, nestedPath.entity, rf.nested.where);

          const innerClause: Record<string, unknown> = {
            ...(relatedWhere ?? {}),
            [rf.nested.relation]: { [rf.nested.operator]: nestedWhere ?? {} },
          };
          result[prismaRelationName] = { [rf.operator]: innerClause };
        }
      } else {
        result[prismaRelationName] = { [rf.operator]: relatedWhere ?? {} };
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  private mergeWhere(
    directWhere: Record<string, unknown> | undefined,
    relWhere: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined {
    if (!directWhere && !relWhere) return undefined;
    return { ...(directWhere ?? {}), ...(relWhere ?? {}) };
  }

  private isIsoDatetime(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  }

  private resolveDateExpression(value: string): string | null {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (normalized === 'today' || normalized === 'hoy') {
      return today.toISOString();
    }
    if (normalized === 'yesterday' || normalized === 'ayer') {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return d.toISOString();
    }
    if (normalized === 'tomorrow' || normalized === 'manana') {
      const d = new Date(today);
      d.setDate(d.getDate() + 1);
      return d.toISOString();
    }

    return null;
  }

  private safeJsonParse<T>(raw: string): T {
    // Strip markdown code fences if present
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    // Try direct parse first (fast path)
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // LLM sometimes outputs multiple JSON objects (self-correction) or adds prose around them.
      // Scan for all top-level balanced JSON objects and return the last valid one,
      // since when the model self-corrects the last object is the intended answer.
      const candidates: T[] = [];
      let i = 0;

      while (i < cleaned.length) {
        const start = cleaned.indexOf('{', i);
        if (start === -1) break;

        // Walk forward tracking brace depth to find the matching closing brace
        let depth = 0;
        let inString = false;
        let escape = false;
        let j = start;

        for (; j < cleaned.length; j++) {
          const ch = cleaned[j];
          if (escape) { escape = false; continue; }
          if (ch === '\\' && inString) { escape = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) break;
          }
        }

        if (depth === 0) {
          try {
            candidates.push(JSON.parse(cleaned.slice(start, j + 1)) as T);
          } catch {
            // not a valid JSON object, skip
          }
        }

        i = j + 1;
      }

      if (candidates.length > 0) {
        return candidates[candidates.length - 1];
      }

      this.logger.warn(`safeJsonParse failed. Raw LLM output: ${cleaned.slice(0, 500)}`);
      throw new BadRequestException('La respuesta de IA no vino en JSON válido.');
    }
  }

  private normalizeFieldValue(entity: AllowedEntity, field: string, value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    // Resolve relative date expressions before other normalization
    // Prisma always requires full ISO-8601 datetime, even for @db.Date fields
    const dateResolved = this.resolveDateExpression(value);
    if (dateResolved !== null) {
      return dateResolved;
    }

    // If the LLM sends a bare date "YYYY-MM-DD" (without time), append T00:00:00.000Z
    // so Prisma doesn't reject it with "premature end of input. Expected ISO-8601 DateTime"
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      return `${value.trim()}T00:00:00.000Z`;
    }

    const normalizedKey = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    if (entity === 'tripHistories' && field === 'status') {
      return TRIP_STATUS_MAP[normalizedKey] ?? value;
    }

    if ((entity === 'trucks' || entity === 'truckPlateChangeLogs') && field === 'status') {
      return TRUCK_STATUS_MAP[normalizedKey] ?? value;
    }

    if (entity === 'truckPlateChangeLogs' && (field === 'previousStatus' || field === 'newStatus')) {
      return TRUCK_STATUS_MAP[normalizedKey] ?? value;
    }

    if (entity === 'truckPlateChangeLogs' && field === 'reason') {
      return PLATE_REASON_MAP[normalizedKey] ?? value;
    }

    if (entity === 'problemReports' && field === 'status') {
      return REPORT_STATUS_MAP[normalizedKey] ?? value;
    }

    if (entity === 'users' && field === 'role') {
      return ROLE_MAP[normalizedKey] ?? value;
    }

    if (entity === 'maintenanceItems' && field === 'status') {
      return MAINTENANCE_ITEM_STATUS_MAP[normalizedKey] ?? value;
    }

    if (entity === 'maintenanceItems' && field === 'exists') {
      return MAINTENANCE_ITEM_EXISTS_MAP[normalizedKey] ?? value;
    }

    return value;
  }

  private isAllowedEnumValue(entity: AllowedEntity, field: string, value: unknown): boolean {
    if (typeof value !== 'string') {
      return true;
    }

    if (entity === 'users' && field === 'role') {
      return Object.values(UserRole).includes(value as UserRole);
    }

    if (entity === 'tripHistories' && field === 'status') {
      return Object.values(TripHistoryStatus).includes(value as TripHistoryStatus);
    }

    if (entity === 'problemReports' && field === 'status') {
      return Object.values(ProblemReportStatus).includes(
        value as ProblemReportStatus,
      );
    }

    if (entity === 'truckPlateChangeLogs' && field === 'reason') {
      return Object.values(PlateChangeReason).includes(value as PlateChangeReason);
    }

    if (
      (entity === 'trucks' && field === 'status') ||
      (entity === 'truckPlateChangeLogs' &&
        (field === 'status' || field === 'previousStatus' || field === 'newStatus'))
    ) {
      return Object.values(TruckStatus).includes(value as TruckStatus);
    }

    return true;
  }

  private async createChatCompletionWithFallback(
    groq: Groq,
    payload: {
      temperature: number;
      max_completion_tokens: number;
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    },
  ) {
    const modelsToTry = [
      this.model,
      ...this.fallbackModels.filter((candidate) => candidate !== this.model),
    ];

    let lastError: unknown;

    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= this.maxRetriesPerModel; attempt += 1) {
        try {
          return await groq.chat.completions.create({
            model,
            temperature: payload.temperature,
            max_completion_tokens: payload.max_completion_tokens,
            messages: payload.messages,
          });
        } catch (error) {
          lastError = error;

          if (!this.isRetryableGroqError(error)) {
            throw new ServiceUnavailableException(this.buildGroqErrorMessage(error));
          }

          if (attempt < this.maxRetriesPerModel) {
            const waitMs = this.getRetryDelayMs(error, attempt);
            await this.sleep(waitMs);
            continue;
          }
        }
      }
    }

    throw new ServiceUnavailableException(
      this.buildGroqErrorMessage(lastError) ||
        'Groq no está disponible por capacidad en este momento. Intenta nuevamente en unos segundos.',
    );
  }

  private isRetryableGroqError(error: unknown): boolean {
    const status = this.getGroqStatus(error);
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
  }

  private getGroqStatus(error: unknown): number | undefined {
    const maybeError = error as { status?: number };
    return maybeError?.status;
  }

  private buildGroqErrorMessage(error: unknown): string {
    const maybeError = error as {
      error?: {
        error?: {
          message?: string;
        };
      };
      message?: string;
      status?: number;
    };

    const providerMessage =
      maybeError?.error?.error?.message ||
      maybeError?.message ||
      'Proveedor de IA no disponible temporalmente.';

    return `Groq no disponible temporalmente (${maybeError?.status ?? 'sin status'}): ${providerMessage}`;
  }

  private getRetryDelayMs(error: unknown, attempt: number): number {
    const maybeError = error as {
      headers?: {
        get?: (name: string) => string | null;
      };
    };

    const retryAfterRaw = maybeError?.headers?.get?.('retry-after');
    const retryAfterSeconds = Number(retryAfterRaw);

    if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
      return Math.min(retryAfterSeconds * 1000, 30000);
    }

    const baseDelayMs = 1000;
    const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);
    return Math.min(exponentialDelay, 8000);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getPrismaDelegate(entity: AllowedEntity) {
    const map: Record<AllowedEntity, any> = {
      users: this.prisma.user,
      trucks: this.prisma.truck,
      destinations: this.prisma.destination,
      patients: this.prisma.patient,
      tripHistories: this.prisma.tripHistory,
      vehicleMaintenanceRecords: this.prisma.vehicleMaintenanceRecord,
      maintenanceItems: this.prisma.maintenanceItem,
      problemReports: this.prisma.problemReport,
      occupations: this.prisma.occupation,
      truckPlateChangeLogs: this.prisma.truckPlateChangeLog,
      truckAssignments: this.prisma.truckAssignment,
    };

    return map[entity];
  }
}