-- AlterTable: add managedBy to Destination
ALTER TABLE "Destination" ADD COLUMN "managedBy" "UserRole" NOT NULL DEFAULT 'ADMIN';

-- DropIndex: remove old unique on name
DROP INDEX IF EXISTS "Destination_name_key";

-- CreateIndex: add composite unique on (name, managedBy)
CREATE UNIQUE INDEX "Destination_name_managedBy_key" ON "Destination"("name", "managedBy");
