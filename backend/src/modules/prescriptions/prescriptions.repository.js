import prisma from '../../infra/prisma.js';

export async function create(data, tx) {
  const db = tx || prisma;
  return db.prescription.create({ data });
}

export async function findById(id, tx) {
  const db = tx || prisma;
  return db.prescription.findUnique({
    where: { id },
    include: {
      visit: true,
      prescribedBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
}

export async function findByVisitId(visitId, tx) {
  const db = tx || prisma;
  return db.prescription.findMany({
    where: { visitId },
    orderBy: { createdAt: 'asc' },
    include: {
      prescribedBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
}

export async function update(id, data, tx) {
  const db = tx || prisma;
  return db.prescription.update({
    where: { id },
    data,
  });
}

export async function remove(id, tx) {
  const db = tx || prisma;
  return db.prescription.delete({
    where: { id },
  });
}

