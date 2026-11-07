import prisma from '../../infra/prisma.js';

const ACTIVE_STATUSES = ['SCHEDULED', 'CHECKED_IN', 'COMPLETED'];

const DEFAULT_INCLUDE = {
  patient: {
    select: {
      id: true,
      mrn: true,
      firstName: true,
      lastName: true,
      phone: true,
      gender: true,
    },
  },
  doctor: {
    select: {
      id: true,
      specialization: true,
      licenseNumber: true,
      slotDurationMin: true,
      consultationFee: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  histories: {
    orderBy: { createdAt: 'desc' },
    take: 10,
  },
};

/**
 * Create a new appointment.
 */
export async function create(data, tx) {
  const db = tx || prisma;
  return db.appointment.create({
    data,
    include: DEFAULT_INCLUDE,
  });
}

/**
 * Find an appointment by ID.
 */
export async function findById(id, tx) {
  const db = tx || prisma;
  return db.appointment.findUnique({
    where: { id },
    include: DEFAULT_INCLUDE,
  });
}

/**
 * Find active appointments for a doctor within a time window.
 */
export async function findActiveDoctorAppointments(doctorId, fromDate, toDate, tx) {
  const db = tx || prisma;
  return db.appointment.findMany({
    where: {
      doctorId,
      status: { in: ACTIVE_STATUSES },
      startTime: {
        gte: fromDate,
        lte: toDate,
      },
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      status: true,
    },
  });
}

/**
 * Check if a patient has an active appointment overlapping a given time window.
 */
export async function findOverlappingPatientAppointment(patientId, startTime, endTime, excludeAppointmentId = null, tx) {
  const db = tx || prisma;
  const where = {
    patientId,
    status: { in: ACTIVE_STATUSES },
    startTime: { lt: endTime },
    endTime: { gt: startTime },
  };

  if (excludeAppointmentId) {
    where.id = { not: excludeAppointmentId };
  }

  return db.appointment.findFirst({ where });
}

/**
 * Update an appointment.
 */
export async function update(id, data, tx) {
  const db = tx || prisma;
  return db.appointment.update({
    where: { id },
    data,
    include: DEFAULT_INCLUDE,
  });
}

/**
 * Create an appointment history entry.
 */
export async function createHistory(data, tx) {
  const db = tx || prisma;
  return db.appointmentHistory.create({
    data,
  });
}

/**
 * Find all appointments with pagination, search, and filters.
 */
export async function findAll(filters) {
  const {
    skip,
    take,
    orderBy = [{ startTime: 'desc' }],
    doctorId,
    patientId,
    status,
    from,
    to,
    search,
  } = filters;

  const where = {};

  if (doctorId) where.doctorId = doctorId;
  if (patientId) where.patientId = patientId;
  if (status) where.status = status;

  if (from || to) {
    where.startTime = {};
    if (from) where.startTime.gte = new Date(from);
    if (to) where.startTime.lte = new Date(to);
  }

  if (search) {
    where.OR = [
      { patient: { firstName: { contains: search, mode: 'insensitive' } } },
      { patient: { lastName: { contains: search, mode: 'insensitive' } } },
      { patient: { mrn: { contains: search, mode: 'insensitive' } } },
      { patient: { phone: { contains: search, mode: 'insensitive' } } },
    ];
  }

  return prisma.appointment.findMany({
    where,
    orderBy,
    skip,
    take,
    include: DEFAULT_INCLUDE,
  });
}

/**
 * Count appointments matching filters.
 */
export async function count(filters) {
  const {
    doctorId,
    patientId,
    status,
    from,
    to,
    search,
  } = filters;

  const where = {};

  if (doctorId) where.doctorId = doctorId;
  if (patientId) where.patientId = patientId;
  if (status) where.status = status;

  if (from || to) {
    where.startTime = {};
    if (from) where.startTime.gte = new Date(from);
    if (to) where.startTime.lte = new Date(to);
  }

  if (search) {
    where.OR = [
      { patient: { firstName: { contains: search, mode: 'insensitive' } } },
      { patient: { lastName: { contains: search, mode: 'insensitive' } } },
      { patient: { mrn: { contains: search, mode: 'insensitive' } } },
      { patient: { phone: { contains: search, mode: 'insensitive' } } },
    ];
  }

  return prisma.appointment.count({ where });
}

