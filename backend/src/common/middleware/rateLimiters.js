import rateLimit from 'express-rate-limit';

/**
 * Strict rate limiter for authentication endpoints.
 * Enforces: 5 attempts / 15 minutes per IP + email combination.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    return `${ip}:${email}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts. Please try again after 15 minutes.',
        details: [],
        requestId: req.id || req.headers['x-request-id'] || 'unknown',
      },
    });
  },
});

/**
 * General API rate limiter.
 * Protects server against DDoS and brute force scanning.
 * 200 requests per 1-minute window per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'test' ? 10000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down.',
        details: [],
        requestId: req.id || req.headers['x-request-id'] || 'unknown',
      },
    });
  },
});
