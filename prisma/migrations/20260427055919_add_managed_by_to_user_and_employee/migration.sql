-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "managedBy" "UserRole" NOT NULL DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "managedBy" "UserRole" NOT NULL DEFAULT 'ADMIN';
