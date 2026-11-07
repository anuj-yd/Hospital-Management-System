import prisma from '../../infra/prisma.js';

/**
 * Repository executing pure PostgreSQL aggregations for Reports & Analytics.
 */

/**
 * Fetch aggregated dashboard statistics.
 */
export async function getDashboardMetrics() {
  const now = new Date();

  // UTC boundaries for today
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

  // Upcoming 7 days boundary
  const endOf7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // UTC start of current month
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

  const [
    todayStatusCounts,
    upcomingResult,
    newPatientsResult,
    outstandingResult,
    revenueResult,
  ] = await Promise.all([
    // 1. Today's appointments by status
    prisma.$queryRaw`
      SELECT
        status,
        COUNT(*)::int as count
      FROM "Appointment"
      WHERE "startTime" >= ${startOfToday} AND "startTime" <= ${endOfToday}
      GROUP BY status
    `,

    // 2. Upcoming 7 days appointments count
    prisma.$queryRaw`
      SELECT COUNT(*)::int as count
      FROM "Appointment"
      WHERE "startTime" >= ${now} AND "startTime" <= ${endOf7Days}
        AND status IN ('SCHEDULED', 'CHECKED_IN')
    `,

    // 3. New patients this month
    prisma.$queryRaw`
      SELECT COUNT(*)::int as count
      FROM "Patient"
      WHERE "createdAt" >= ${startOfMonth}
    `,

    // 4. Outstanding balance total across active invoices
    prisma.$queryRaw`
      SELECT COALESCE(SUM("totalAmount" - "amountPaid"), 0)::numeric as outstanding
      FROM "Invoice"
      WHERE status IN ('ISSUED', 'PARTIALLY_PAID')
    `,

    // 5. Revenue this month from SUCCEEDED payments
    prisma.$queryRaw`
      SELECT COALESCE(SUM(amount), 0)::numeric as revenue
      FROM "Payment"
      WHERE status = 'SUCCEEDED' AND "createdAt" >= ${startOfMonth}
    `,
  ]);

  return {
    todayAppointmentsByStatus: todayStatusCounts,
    upcoming7DaysCount: upcomingResult[0]?.count || 0,
    newPatientsThisMonth: newPatientsResult[0]?.count || 0,
    outstandingBalanceTotal: Number(outstandingResult[0]?.outstanding || 0).toFixed(2),
    revenueThisMonth: Number(revenueResult[0]?.revenue || 0).toFixed(2),
  };
}

/**
 * Appointments summary aggregated using PostgreSQL SQL group-by queries.
 */
export async function getAppointmentsSummary({ from = null, to = null, groupBy = 'status' }) {
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  // Global rates query for total, cancellations, and no-shows in period
  const overallSummaryResult = await prisma.$queryRawUnsafe(
    `SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'SCHEDULED')::int AS scheduled,
      COUNT(*) FILTER (WHERE status = 'CHECKED_IN')::int AS "checkedIn",
      COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
      COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
      COUNT(*) FILTER (WHERE status = 'NO_SHOW')::int AS "noShow",
      ROUND(
        CASE WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE status = 'CANCELLED')::numeric / COUNT(*)::numeric) * 100 ELSE 0 END, 2
      )::float AS "cancellationRate",
      ROUND(
        CASE WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE status = 'NO_SHOW')::numeric / COUNT(*)::numeric) * 100 ELSE 0 END, 2
      )::float AS "noShowRate"
    FROM "Appointment"
    WHERE ($1::timestamptz IS NULL OR "startTime" >= $1::timestamptz)
      AND ($2::timestamptz IS NULL OR "startTime" <= $2::timestamptz)`,
    fromDate,
    toDate,
  );

  let breakdown = [];

  if (groupBy === 'day') {
    breakdown = await prisma.$queryRawUnsafe(
      `SELECT
        TO_CHAR("startTime" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'SCHEDULED')::int AS scheduled,
        COUNT(*) FILTER (WHERE status = 'CHECKED_IN')::int AS "checkedIn",
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
        COUNT(*) FILTER (WHERE status = 'NO_SHOW')::int AS "noShow",
        ROUND(
          CASE WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE status = 'CANCELLED')::numeric / COUNT(*)::numeric) * 100 ELSE 0 END, 2
        )::float AS "cancellationRate",
        ROUND(
          CASE WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE status = 'NO_SHOW')::numeric / COUNT(*)::numeric) * 100 ELSE 0 END, 2
        )::float AS "noShowRate"
      FROM "Appointment"
      WHERE ($1::timestamptz IS NULL OR "startTime" >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR "startTime" <= $2::timestamptz)
      GROUP BY TO_CHAR("startTime" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      ORDER BY day ASC`,
      fromDate,
      toDate,
    );
  } else if (groupBy === 'doctor') {
    breakdown = await prisma.$queryRawUnsafe(
      `SELECT
        a."doctorId" AS "doctorId",
        COALESCE(u."fullName", 'Unknown Doctor') AS "doctorName",
        dept.name AS "departmentName",
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE a.status = 'SCHEDULED')::int AS scheduled,
        COUNT(*) FILTER (WHERE a.status = 'CHECKED_IN')::int AS "checkedIn",
        COUNT(*) FILTER (WHERE a.status = 'COMPLETED')::int AS completed,
        COUNT(*) FILTER (WHERE a.status = 'CANCELLED')::int AS cancelled,
        COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')::int AS "noShow",
        ROUND(
          CASE WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE a.status = 'CANCELLED')::numeric / COUNT(*)::numeric) * 100 ELSE 0 END, 2
        )::float AS "cancellationRate",
        ROUND(
          CASE WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')::numeric / COUNT(*)::numeric) * 100 ELSE 0 END, 2
        )::float AS "noShowRate"
      FROM "Appointment" a
      JOIN "Doctor" d ON d.id = a."doctorId"
      LEFT JOIN "User" u ON u.id = d."userId"
      LEFT JOIN "Department" dept ON dept.id = d."departmentId"
      WHERE ($1::timestamptz IS NULL OR a."startTime" >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR a."startTime" <= $2::timestamptz)
      GROUP BY a."doctorId", u."fullName", dept.name
      ORDER BY total DESC`,
      fromDate,
      toDate,
    );
  } else if (groupBy === 'department') {
    breakdown = await prisma.$queryRawUnsafe(
      `SELECT
        dept.id AS "departmentId",
        dept.name AS "departmentName",
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE a.status = 'SCHEDULED')::int AS scheduled,
        COUNT(*) FILTER (WHERE a.status = 'CHECKED_IN')::int AS "checkedIn",
        COUNT(*) FILTER (WHERE a.status = 'COMPLETED')::int AS completed,
        COUNT(*) FILTER (WHERE a.status = 'CANCELLED')::int AS cancelled,
        COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')::int AS "noShow",
        ROUND(
          CASE WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE a.status = 'CANCELLED')::numeric / COUNT(*)::numeric) * 100 ELSE 0 END, 2
        )::float AS "cancellationRate",
        ROUND(
          CASE WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')::numeric / COUNT(*)::numeric) * 100 ELSE 0 END, 2
        )::float AS "noShowRate"
      FROM "Appointment" a
      JOIN "Doctor" d ON d.id = a."doctorId"
      JOIN "Department" dept ON dept.id = d."departmentId"
      WHERE ($1::timestamptz IS NULL OR a."startTime" >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR a."startTime" <= $2::timestamptz)
      GROUP BY dept.id, dept.name
      ORDER BY total DESC`,
      fromDate,
      toDate,
    );
  } else {
    // groupBy === 'status'
    breakdown = await prisma.$queryRawUnsafe(
      `SELECT
        status,
        COUNT(*)::int AS count,
        ROUND(
          (COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0)::numeric) * 100, 2
        )::float AS percentage
      FROM "Appointment"
      WHERE ($1::timestamptz IS NULL OR "startTime" >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR "startTime" <= $2::timestamptz)
      GROUP BY status
      ORDER BY count DESC`,
      fromDate,
      toDate,
    );
  }

  return {
    summary: overallSummaryResult[0] || {
      total: 0,
      scheduled: 0,
      checkedIn: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      cancellationRate: 0,
      noShowRate: 0,
    },
    groupBy,
    breakdown,
  };
}

/**
 * Billing summary aggregated using PostgreSQL SQL queries.
 */
export async function getBillingSummary({ from = null, to = null }) {
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const [
    invoicedResult,
    collectedResult,
    outstandingResult,
    statusBreakdown,
    methodBreakdown,
  ] = await Promise.all([
    // Invoiced total (all non-void invoices)
    prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM("totalAmount"), 0)::numeric AS "invoicedTotal"
      FROM "Invoice"
      WHERE status != 'VOID'
        AND ($1::timestamptz IS NULL OR "createdAt" >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR "createdAt" <= $2::timestamptz)`,
      fromDate,
      toDate,
    ),

    // Collected total (all succeeded payments)
    prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS "collectedTotal"
      FROM "Payment"
      WHERE status = 'SUCCEEDED'
        AND ($1::timestamptz IS NULL OR "createdAt" >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR "createdAt" <= $2::timestamptz)`,
      fromDate,
      toDate,
    ),

    // Outstanding balance (unpaid balance on ISSUED or PARTIALLY_PAID)
    prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM("totalAmount" - "amountPaid"), 0)::numeric AS "outstandingBalance"
      FROM "Invoice"
      WHERE status IN ('ISSUED', 'PARTIALLY_PAID')
        AND ($1::timestamptz IS NULL OR "createdAt" >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR "createdAt" <= $2::timestamptz)`,
      fromDate,
      toDate,
    ),

    // Counts and total amounts grouped by invoice status
    prisma.$queryRawUnsafe(
      `SELECT
        status,
        COUNT(*)::int AS count,
        COALESCE(SUM("totalAmount"), 0)::numeric AS "totalAmount"
      FROM "Invoice"
      WHERE ($1::timestamptz IS NULL OR "createdAt" >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR "createdAt" <= $2::timestamptz)
      GROUP BY status
      ORDER BY count DESC`,
      fromDate,
      toDate,
    ),

    // Collections grouped by payment method
    prisma.$queryRawUnsafe(
      `SELECT
        method,
        COUNT(*)::int AS count,
        COALESCE(SUM(amount), 0)::numeric AS amount
      FROM "Payment"
      WHERE status = 'SUCCEEDED'
        AND ($1::timestamptz IS NULL OR "createdAt" >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR "createdAt" <= $2::timestamptz)
      GROUP BY method
      ORDER BY amount DESC`,
      fromDate,
      toDate,
    ),
  ]);

  return {
    invoicedTotal: Number(invoicedResult[0]?.invoicedTotal || 0).toFixed(2),
    collectedTotal: Number(collectedResult[0]?.collectedTotal || 0).toFixed(2),
    outstandingBalance: Number(outstandingResult[0]?.outstandingBalance || 0).toFixed(2),
    countByStatus: statusBreakdown.reduce((acc, row) => {
      acc[row.status] = {
        count: row.count,
        totalAmount: Number(row.totalAmount).toFixed(2),
      };
      return acc;
    }, {}),
    statusList: statusBreakdown.map((row) => ({
      status: row.status,
      count: row.count,
      totalAmount: Number(row.totalAmount).toFixed(2),
    })),
    collectionsByPaymentMethod: methodBreakdown.map((row) => ({
      method: row.method,
      count: row.count,
      amount: Number(row.amount).toFixed(2),
    })),
  };
}

