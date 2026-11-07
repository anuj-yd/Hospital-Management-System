import * as repo from './reports.repository.js';

/**
 * Service for Reports, Dashboard & Analytics.
 */

/**
 * GET /reports/dashboard
 */
export async function getDashboard() {
  const data = await repo.getDashboardMetrics();

  const statusMap = {
    SCHEDULED: 0,
    CHECKED_IN: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    NO_SHOW: 0,
  };

  data.todayAppointmentsByStatus.forEach((item) => {
    if (statusMap[item.status] !== undefined) {
      statusMap[item.status] = item.count;
    }
  });

  return {
    todayAppointments: {
      byStatus: statusMap,
      details: data.todayAppointmentsByStatus,
    },
    upcoming7DaysCount: data.upcoming7DaysCount,
    newPatientsThisMonth: data.newPatientsThisMonth,
    outstandingBalanceTotal: data.outstandingBalanceTotal,
    revenueThisMonth: data.revenueThisMonth,
  };
}

/**
 * GET /reports/appointments-summary
 */
export async function getAppointmentsSummary(query) {
  const { from, to, groupBy = 'status' } = query;
  return repo.getAppointmentsSummary({ from, to, groupBy });
}

/**
 * GET /reports/billing-summary
 */
export async function getBillingSummary(query) {
  const { from, to } = query;
  return repo.getBillingSummary({ from, to });
}

