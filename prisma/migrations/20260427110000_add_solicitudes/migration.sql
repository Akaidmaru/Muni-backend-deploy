CREATE TABLE "Solicitud" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "conductorOpcion" TEXT,
    "nombre" TEXT,
    "patente" TEXT,
    "razon" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDING',
    "requesterId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Solicitud_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Solicitud_requesterId_idx" ON "Solicitud"("requesterId");
CREATE INDEX "Solicitud_estado_idx" ON "Solicitud"("estado");
CREATE INDEX "Solicitud_createdAt_idx" ON "Solicitud"("createdAt");

ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
