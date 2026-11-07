import { describe, it, expect } from '@jest/globals';
import {
  appointmentsSummaryQuerySchema,
  billingSummaryQuerySchema,
  GROUP_BY_OPTIONS,
} from '../../src/modules/reports/reports.schema.js';
import { listAuditLogsSchema } from '../../src/modules/audit/audit.schema.js';

describe('Phase 7 Reporting & Audit Schema Unit Tests', () => {
  describe('Appointments Summary Schema', () => {
    it('accepts valid groupBy options: day, doctor, department, status', () => {
      for (const opt of GROUP_BY_OPTIONS) {
        const parsed = appointmentsSummaryQuerySchema.safeParse({ groupBy: opt });
        expect(parsed.success).toBe(true);
        expect(parsed.data.groupBy).toBe(opt);
      }
    });

    it('defaults groupBy to status when omitted', () => {
      const parsed = appointmentsSummaryQuerySchema.safeParse({});
      expect(parsed.success).toBe(true);
      expect(parsed.data.groupBy).toBe('status');
    });

    it('rejects invalid groupBy option', () => {
      const parsed = appointmentsSummaryQuerySchema.safeParse({ groupBy: 'invalid_metric' });
      expect(parsed.success).toBe(false);
    });

    it('accepts optional date range', () => {
      const parsed = appointmentsSummaryQuerySchema.safeParse({
        from: '2026-01-01',
        to: '2026-12-31',
        groupBy: 'day',
      });
      expect(parsed.success).toBe(true);
      expect(parsed.data.from).toBe('2026-01-01');
    });
  });

  describe('Billing Summary Schema', () => {
    it('accepts empty parameters for global summary', () => {
      const parsed = billingSummaryQuerySchema.safeParse({});
      expect(parsed.success).toBe(true);
    });

    it('accepts valid date range parameters', () => {
      const parsed = billingSummaryQuerySchema.safeParse({
        from: '2026-11-01T00:00:00Z',
        to: '2026-11-30T23:59:59Z',
      });
      expect(parsed.success).toBe(true);
      expect(parsed.data.from).toBe('2026-11-01T00:00:00Z');
    });
  });

  describe('Audit Logs Schema', () => {
    it('accepts valid audit log query filters', () => {
      const query = {
        userId: '10000000-0000-0000-0000-000000000001',
        entity: 'Appointment',
        entityId: '50000000-0000-0000-0000-000000000001',
        action: 'STATUS_CHANGE',
        from: '2026-11-01',
        to: '2026-11-07',
        page: '1',
        limit: '50',
      };
      const parsed = listAuditLogsSchema.safeParse(query);
      expect(parsed.success).toBe(true);
      expect(parsed.data.entity).toBe('Appointment');
      expect(parsed.data.action).toBe('STATUS_CHANGE');
    });

    it('rejects invalid userId UUID', () => {
      const query = {
        userId: 'non-uuid-string',
      };
      const parsed = listAuditLogsSchema.safeParse(query);
      expect(parsed.success).toBe(false);
    });
  });
});

