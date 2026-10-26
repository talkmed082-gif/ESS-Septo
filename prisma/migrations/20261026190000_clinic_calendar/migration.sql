-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clinicCalendar" JSONB,
ADD COLUMN     "clinicCalendarAt" TIMESTAMP(3);
