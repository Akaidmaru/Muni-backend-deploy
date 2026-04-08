-- DropForeignKey
ALTER TABLE "RoutePoint" DROP CONSTRAINT IF EXISTS "RoutePoint_routeId_fkey";

-- DropForeignKey
ALTER TABLE "Route" DROP CONSTRAINT IF EXISTS "Route_truckId_fkey";

-- DropTable
DROP TABLE IF EXISTS "RoutePoint";

-- DropTable
DROP TABLE IF EXISTS "Route";