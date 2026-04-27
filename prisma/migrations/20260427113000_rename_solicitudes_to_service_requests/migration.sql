ALTER TABLE "Solicitud" RENAME TO "ServiceRequest";

ALTER TABLE "ServiceRequest" RENAME COLUMN "tipo" TO "requestType";
ALTER TABLE "ServiceRequest" RENAME COLUMN "conductorOpcion" TO "driverAction";
ALTER TABLE "ServiceRequest" RENAME COLUMN "nombre" TO "personName";
ALTER TABLE "ServiceRequest" RENAME COLUMN "patente" TO "plate";
ALTER TABLE "ServiceRequest" RENAME COLUMN "razon" TO "reason";
ALTER TABLE "ServiceRequest" RENAME COLUMN "estado" TO "status";

ALTER TABLE "ServiceRequest" RENAME CONSTRAINT "Solicitud_pkey" TO "ServiceRequest_pkey";
ALTER TABLE "ServiceRequest" RENAME CONSTRAINT "Solicitud_requesterId_fkey" TO "ServiceRequest_requesterId_fkey";

ALTER INDEX "Solicitud_requesterId_idx" RENAME TO "ServiceRequest_requesterId_idx";
ALTER INDEX "Solicitud_estado_idx" RENAME TO "ServiceRequest_status_idx";
ALTER INDEX "Solicitud_createdAt_idx" RENAME TO "ServiceRequest_createdAt_idx";
