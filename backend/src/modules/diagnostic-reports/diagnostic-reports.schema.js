import { z } from 'zod';

export const createDiagnosticReportSchema = z.object({
  reportType: z.string().trim().min(1, 'Report type is required (e.g. ECG, CBC, X-Ray)').max(150),
  resultSummary: z.string().trim().max(5000).optional(),
  fileReference: z.string().trim().max(255).optional(), // metadata reference string only, no file upload
});

export const updateDiagnosticReportSchema = z.object({
  status: z.enum(['COMPLETED', 'CANCELLED']),
  resultSummary: z.string().trim().max(5000).optional(),
  fileReference: z.string().trim().max(255).optional(),
}).refine(
  (data) => {
    if (data.status === 'COMPLETED' && (!data.resultSummary || data.resultSummary.trim() === '')) {
      return false;
    }
    return true;
  },
  {
    message: 'resultSummary text is required when marking a diagnostic report as COMPLETED',
    path: ['resultSummary'],
  },
);

export const reportIdParamSchema = z.object({
  id: z.string().uuid('Invalid diagnostic report ID format'),
});

export const visitIdParamSchema = z.object({
  id: z.string().uuid('Invalid visit ID format'),
});

