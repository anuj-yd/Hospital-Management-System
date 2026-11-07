import prisma from '../../infra/prisma.js';

export async function create(data, tx) {
  const db = tx || prisma;
  return db.diagnosticReport.create({ data });
}

export async function findById(id, tx) {
  const db = tx || prisma;
  return db.diagnosticReport.findUnique({
    where: { id },
    include: {
      visit: true,
      orderedBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
}

export async function findByVisitId(visitId, tx) {
  const db = tx || prisma;
  return db.diagnosticReport.findMany({
    where: { visitId },
    orderBy: { createdAt: 'asc' },
    include: {
      orderedBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
}

export async function update(id, data, tx) {
  const db = tx || prisma;
  return db.diagnosticReport.update({
    where: { id },
    data,
  });
}

