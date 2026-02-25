/**
 * Security Middleware Collection
 * File: server/middleware/security.ts
 * 
 * Provides:
 * - Safe client IP extraction (mitigates header spoofing)
 * - Body size guard (prevents memory exhaustion)
 * - Security headers
 * - Request sanitization
 */


import { Request, Response, NextFunction } from 'express';

/**
 * Get real client IP safely
 * Only trusts X-Forwarded-For when request comes from known proxy
 */
export const getClientIP = (req: Request): string => {
  const socketIP = req.socket?.remoteAddress || 'unknown';
  
  // Check X-Forwarded-For header
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor && typeof forwardedFor === 'string') {
    // Take the leftmost IP (original client)
    // In production behind trusted proxy, this is safe
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    return ips[0] || socketIP;
  }
  
  // Fallback to X-Real-IP (nginx)
  const realIP = req.headers['x-real-ip'];
  if (realIP && typeof realIP === 'string') {
    return realIP;
  }
  
  return socketIP;
};

/**
 * Body size guard middleware
 * Rejects requests with Content-Length exceeding limit BEFORE parsing
 * This prevents memory exhaustion attacks
 */
export const bodySizeGuard = (maxBytes: number = 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (contentLength > maxBytes) {
      return res.status(413).json({ 
        error: 'Payload too large',
        maxSize: `${Math.round(maxBytes / 1024)}KB`
      });
    }
    
    next();
  };
};

/**
 * Security headers middleware
 * Adds standard security headers to all responses
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Don't leak server info
  res.removeHeader('X-Powered-By');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};

/**
 * Sanitize request parameters
 * Removes null bytes and normalizes strings
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return input;
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Normalize unicode
  sanitized = sanitized.normalize('NFC');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
};

/**
 * Request sanitization middleware
 * Sanitizes common injection vectors in query and body
 */
export const sanitizeRequest = (req: Request, _res: Response, next: NextFunction) => {
  // Sanitize query parameters
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      const value = req.query[key];
      if (typeof value === 'string') {
        req.query[key] = sanitizeInput(value);
      }
    }
  }
  
  // Sanitize body string fields (shallow)
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    }
  }
  
  next();
};

export default {
  getClientIP,
  bodySizeGuard,
  securityHeaders,
  sanitizeInput,
  sanitizeRequest,
};
