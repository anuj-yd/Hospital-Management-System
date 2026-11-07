import { describe, it, expect } from '@jest/globals';
import { ZodError, z } from 'zod';
import { errorHandler } from '../../src/common/middleware/errorHandler.js';
import {
  AppError,
  ValidationError,
  UnauthenticatedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  SlotTakenError,
  PatientDoubleBookedError,
  BusinessRuleError,
} from '../../src/common/errors/index.js';
import {
  buildPagination,
  buildPaginationMeta,
  parsePagination,
  parseSortParam,
} from '../../src/common/utils/pagination.js';

describe('Phase 8 Infrastructure Unit Tests', () => {
  describe('Pagination Parser Utilities', () => {
    it('computes correct skip and take offsets from page and limit', () => {
      const p1 = buildPagination(1, 20);
      expect(p1.skip).toBe(0);
      expect(p1.take).toBe(20);

      const p3 = buildPagination(3, 15);
      expect(p3.skip).toBe(30);
      expect(p3.take).toBe(15);
    });

    it('enforces boundaries: page >= 1 and limit capped at MAX_LIMIT', () => {
      const negative = buildPagination(-5, 0);
      expect(negative.skip).toBe(0);
      expect(negative.take).toBe(1);

      const overflow = buildPagination(2, 500);
      expect(overflow.take).toBe(100);
    });

    it('computes pagination metadata correctly', () => {
      const meta = buildPaginationMeta(2, 20, 55);
      expect(meta.page).toBe(2);
      expect(meta.limit).toBe(20);
      expect(meta.total).toBe(55);
      expect(meta.totalPages).toBe(3);
      expect(meta.hasPrev).toBe(true);
      expect(meta.hasNext).toBe(true);

      const lastPageMeta = buildPaginationMeta(3, 20, 55);
      expect(lastPageMeta.hasNext).toBe(false);
    });

    it('parses sort parameter safely', () => {
      const allowed = ['createdAt', 'startTime', 'name'];

      const s1 = parseSortParam('createdAt:desc', allowed);
      expect(s1).toEqual([{ createdAt: 'desc' }]);

      const s2 = parseSortParam('startTime:asc', allowed);
      expect(s2).toEqual([{ startTime: 'asc' }]);

      const invalid = parseSortParam('maliciousColumn:asc', allowed);
      expect(invalid).toEqual([]);
    });
  });

  describe('Central Error Handler Mapping', () => {
    function mockResponse() {
      const res = {};
      res.statusCode = 200;
      res.status = function (code) {
        res.statusCode = code;
        return res;
      };
      res.json = function (payload) {
        res.body = payload;
        return res;
      };
      return res;
    }

    const mockReq = { id: 'test-req-123', headers: {} };

    it('maps ZodError to 400 VALIDATION_ERROR', () => {
      const res = mockResponse();
      let zodErr;
      try {
        z.object({ email: z.string().email() }).parse({ email: 'bad-email' });
      } catch (e) {
        zodErr = e;
      }

      errorHandler(zodErr, mockReq, res, () => {});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.length).toBeGreaterThan(0);
    });

    it('maps SyntaxError (malformed JSON) to 400 MALFORMED_JSON', () => {
      const res = mockResponse();
      const syntaxErr = new SyntaxError('Unexpected token in JSON');
      syntaxErr.status = 400;
      syntaxErr.body = '{ bad json';

      errorHandler(syntaxErr, mockReq, res, () => {});
      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('MALFORMED_JSON');
    });

    it('maps Prisma P2002 to 409 CONFLICT', () => {
      const res = mockResponse();
      const p2002 = { code: 'P2002', meta: { target: ['email'] } };

      errorHandler(p2002, mockReq, res, () => {});
      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('maps Prisma P2025 to 404 NOT_FOUND', () => {
      const res = mockResponse();
      const p2025 = { code: 'P2025', meta: { cause: 'Record to update not found' } };

      errorHandler(p2025, mockReq, res, () => {});
      expect(res.statusCode).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('maps Postgres 23505 to 409 CONFLICT', () => {
      const res = mockResponse();
      const pg23505 = { code: '23505' };

      errorHandler(pg23505, mockReq, res, () => {});
      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('maps domain AppError subclasses to appropriate status codes', () => {
      const testCases = [
        { err: new UnauthenticatedError(), expectedStatus: 401, expectedCode: 'UNAUTHENTICATED' },
        { err: new ForbiddenError(), expectedStatus: 403, expectedCode: 'FORBIDDEN' },
        { err: new NotFoundError('Invoice', '123'), expectedStatus: 404, expectedCode: 'NOT_FOUND' },
        { err: new ConflictError(), expectedStatus: 409, expectedCode: 'CONFLICT' },
        { err: new SlotTakenError(), expectedStatus: 409, expectedCode: 'SLOT_TAKEN' },
        { err: new PatientDoubleBookedError(), expectedStatus: 422, expectedCode: 'PATIENT_DOUBLE_BOOKED' },
        { err: new BusinessRuleError('Exceeded quota'), expectedStatus: 422, expectedCode: 'BUSINESS_RULE_VIOLATION' },
      ];

      for (const { err, expectedStatus, expectedCode } of testCases) {
        const res = mockResponse();
        errorHandler(err, mockReq, res, () => {});
        expect(res.statusCode).toBe(expectedStatus);
        expect(res.body.error.code).toBe(expectedCode);
      }
    });

    it('maps unhandled exceptions to 500 without leaking internal stack traces', () => {
      const res = mockResponse();
      const rawError = new Error('Database password was incorrect or secret leaked');

      errorHandler(rawError, mockReq, res, () => {});
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(res.body.error).not.toHaveProperty('stack');
    });
  });
});
