import prisma from '../../infra/prisma.js';

export async function create(data, tx) {
  const db = tx || prisma;
  return db.schedule.create({ data });
}

export async function findById(id) {
  return prisma.schedule.findUnique({
    where: { id },
    include: {
      doctor: {
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
    },
  });
}

export async function findAll(filters) {
  const { page = 1, limit = 20, orderBy = [{ createdAt: 'desc' }], doctorId, dayOfWeek, isActive } = filters;

  const where = {};
  if (doctorId) where.doctorId = doctorId;
  if (dayOfWeek !== undefined) where.dayOfWeek = dayOfWeek;
  if (isActive !== undefined) where.isActive = isActive;

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.schedule.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        doctor: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    }),
    prisma.schedule.count({ where }),
  ]);

  return { data, total };
}

export async function update(id, data, tx) {
  const db = tx || prisma;
  return db.schedule.update({ where: { id }, data });
}

/**
 * Find schedules for a specific doctor on a specific day of week.
 * Used for availability checking.
 */
export async function findByDoctorAndDay(doctorId, dayOfWeek) {
  return prisma.schedule.findMany({
    where: { doctorId, dayOfWeek, isActive: true },
    orderBy: { startTime: 'asc' },
  });
}

/**
 * Check for overlapping schedule on the same doctor+day.
 * Two schedules overlap if one starts before the other ends.
 */
export async function findOverlapping(doctorId, dayOfWeek, startTime, endTime, excludeId) {
  const where = {
    doctorId,
    dayOfWeek,
    isActive: true,
    startTime: { lt: endTime },
    endTime: { gt: startTime },
  };
  if (excludeId) where.id = { not: excludeId };
  return prisma.schedule.findFirst({ where });
}
