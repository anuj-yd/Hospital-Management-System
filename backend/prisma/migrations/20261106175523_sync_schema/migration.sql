-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AppointmentHistory" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Department" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DiagnosticReport" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DoctorSchedule" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "IdempotencyKey" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InvoiceItem" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Patient" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Prescription" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RefreshToken" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Visit" ALTER COLUMN "id" DROP DEFAULT;
