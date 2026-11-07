import prisma from '../../infra/prisma.js';

/**
 * Find all schedules for a specific doctor.
 */
export async function findByDoctorId(doctorId) {
  return prisma.doctorSchedule.findMany({
    where: { doctorId },
    orderBy: [
      { dayOfWeek: 'asc' },
      { startTime: 'asc' },
    ],
  });
}

/**
 * Replace all schedules for a doctor atomically in a transaction.
 */
export async function replaceSchedules(doctorId, schedules, tx) {
  const db = tx || prisma;

  // 1. Delete all existing schedules for this doctor
  await db.doctorSchedule.deleteMany({
    where: { doctorId },
  });

  // 2. Insert new schedule windows
  if (schedules && schedules.length > 0) {
    const dataToInsert = schedules.map((s) => ({
      doctorId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      isActive: s.isActive ?? true,
    }));

    await db.doctorSchedule.createMany({
      data: dataToInsert,
    });
  }

  // 3. Return the new active schedules
  return db.doctorSchedule.findMany({
    where: { doctorId },
    orderBy: [
      { dayOfWeek: 'asc' },
      { startTime: 'asc' },
    ],
  });
}
