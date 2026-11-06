import { describe, it, expect } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { passwordRule } from '../../src/modules/auth/auth.schema.js';
import { hashToken, generateAccessToken } from '../../src/modules/auth/auth.service.js';
import { parseDurationMs } from '../../src/common/utils/dates.js';
import { env } from '../../src/config/env.js';

describe('Auth Unit Tests', () => {
  describe('Password Complexity Rules', () => {
    it('accepts compliant passwords', () => {
      expect(passwordRule.safeParse('Admin@12345').success).toBe(true);
      expect(passwordRule.safeParse('Doctor@2026').success).toBe(true);
      expect(passwordRule.safeParse('StrongPass1').success).toBe(true);
    });

    it('rejects passwords shorter than 8 characters', () => {
      const res = passwordRule.safeParse('Short1A');
      expect(res.success).toBe(false);
      expect(res.error?.issues[0]?.message).toMatch(/at least 8 characters/);
    });

    it('rejects passwords without uppercase letter', () => {
      const res = passwordRule.safeParse('lowercase123');
      expect(res.success).toBe(false);
      expect(res.error?.issues[0]?.message).toMatch(/uppercase/);
    });

    it('rejects passwords without lowercase letter', () => {
      const res = passwordRule.safeParse('ALLCAPS123');
      expect(res.success).toBe(false);
      expect(res.error?.issues[0]?.message).toMatch(/lowercase/);
    });

    it('rejects passwords without digit', () => {
      const res = passwordRule.safeParse('NoDigitsHere!');
      expect(res.success).toBe(false);
      expect(res.error?.issues[0]?.message).toMatch(/digit/);
    });
  });

  describe('Token Operations', () => {
    it('computes deterministic SHA-256 token hash', () => {
      const token = 'sample-random-refresh-token';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('generates a valid signed JWT access token', () => {
      const user = {
        id: '10000000-0000-0000-0000-000000000001',
        email: 'admin@hms.test',
        role: 'ADMIN',
        doctor: null,
      };

      const token = generateAccessToken(user);
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
      expect(decoded.sub).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe('ADMIN');
      expect(decoded.doctorId).toBeNull();
    });
  });

  describe('Duration Parsing', () => {
    it('parses duration strings accurately into milliseconds', () => {
      expect(parseDurationMs('15m')).toBe(15 * 60 * 1000);
      expect(parseDurationMs('1h')).toBe(60 * 60 * 1000);
      expect(parseDurationMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
      expect(parseDurationMs('30s')).toBe(30 * 1000);
    });
  });
});

