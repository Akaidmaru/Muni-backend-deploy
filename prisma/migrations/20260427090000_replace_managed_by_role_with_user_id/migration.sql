-- Replace managedBy (UserRole enum) with managedById (FK to User) across all fleet models.
-- NULL managedById means the resource is managed by a top-level ADMIN.

-- User table
ALTER TABLE "User" DROP COLUMN "managedBy";
ALTER TABLE "User" ADD COLUMN "managedById" INTEGER;
ALTER TABLE "User" ADD CONSTRAINT "User_managedById_fkey"
  FOREIGN KEY ("managedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Employee table
ALTER TABLE "Employee" DROP COLUMN "managedBy";
ALTER TABLE "Employee" ADD COLUMN "managedById" INTEGER;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managedById_fkey"
  FOREIGN KEY ("managedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Truck table
ALTER TABLE "Truck" DROP COLUMN "managedBy";
ALTER TABLE "Truck" ADD COLUMN "managedById" INTEGER;
ALTER TABLE "Truck" ADD CONSTRAINT "Truck_managedById_fkey"
  FOREIGN KEY ("managedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Destination table: drop old unique constraint, swap column, add new unique index
DROP INDEX IF EXISTS "Destination_name_managedBy_key";
ALTER TABLE "Destination" DROP COLUMN "managedBy";
ALTER TABLE "Destination" ADD COLUMN "managedById" INTEGER;
ALTER TABLE "Destination" ADD CONSTRAINT "Destination_managedById_fkey"
  FOREIGN KEY ("managedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Destination_name_managedById_key" ON "Destination"("name", "managedById");
