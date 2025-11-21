import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';
import { Parser } from 'json2csv';

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

const router = Router();
const prisma = new PrismaClient();

// Get form analytics summary
router.get('/:formId/summary', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const form = await prisma.form.findFirst({
      where: {
        id: req.params.formId,
        ownerId: userId,
        isDeleted: false,
      },
    });

    if (!form) {
      res.status(404).json({ error: 'Form not found' });
      return;
    }

    const totalResponses = await prisma.formResponse.count({
      where: { formId: req.params.formId },
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Get responses over time
    const responsesOverTime = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE("submittedAt") as date, COUNT(*)::bigint as count
      FROM "FormResponse"
      WHERE "formId" = ${req.params.formId}
        AND "submittedAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("submittedAt")
      ORDER BY date ASC
    `;

    const starred = await prisma.formResponse.count({
      where: { formId: req.params.formId, isStarred: true },
    });

    const flagged = await prisma.formResponse.count({
      where: { formId: req.params.formId, isFlagged: true },
    });

    const lastResponse = await prisma.formResponse.findFirst({
      where: { formId: req.params.formId },
      orderBy: { submittedAt: 'desc' },
      select: { submittedAt: true },
    });

    res.json({
      totalResponses,
      starred,
      flagged,
      responsesOverTime: responsesOverTime.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      createdAt: form.createdAt,
      lastResponseAt: lastResponse?.submittedAt || null,
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get field-level analytics
router.get('/:formId/fields', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const form = await prisma.form.findFirst({
      where: {
        id: req.params.formId,
        ownerId: userId,
        isDeleted: false,
      },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!form) {
      res.status(404).json({ error: 'Form not found' });
      return;
    }

    const fieldAnalytics = await Promise.all(
      form.fields.map(async (field) => {
        const answers = await prisma.formAnswer.findMany({
          where: { fieldId: field.id },
        });

        const totalAnswers = answers.length;
        const filledAnswers = answers.filter((a) => a.value && a.value.trim().length > 0).length;

        const analytics: Record<string, unknown> = {
          fieldId: field.id,
          label: field.label,
          fieldType: field.fieldType,
          totalAnswers,
          filledAnswers,
          fillRate: totalAnswers > 0 ? (filledAnswers / totalAnswers) * 100 : 0,
        };

        // Choice-based fields
        if (
          field.fieldType === 'MULTIPLE_CHOICE' ||
          field.fieldType === 'CHECKBOXES' ||
          field.fieldType === 'DROPDOWN'
        ) {
          const valueCounts: Record<string, number> = {};

          answers.forEach((answer) => {
            if (!answer.value) return;

            let values: string[];
            try {
              const parsed = JSON.parse(answer.value);
              values = Array.isArray(parsed) ? parsed : [answer.value];
            } catch {
              values = [answer.value];
            }

            values.forEach((value) => {
              valueCounts[value] = (valueCounts[value] || 0) + 1;
            });
          });

          analytics.distribution = Object.entries(valueCounts)
            .map(([value, count]) => ({
              value,
              count,
              percentage: totalAnswers > 0 ? (count / totalAnswers) * 100 : 0,
            }))
            .sort((a, b) => b.count - a.count);
        }

        // Rating/scale fields
        if (field.fieldType === 'LINEAR_SCALE' || field.fieldType === 'RATING') {
          const numericValues = answers
            .map((a) => parseFloat(a.value))
            .filter((v) => !Number.isNaN(v));

          if (numericValues.length > 0) {
            const sum = numericValues.reduce((acc, val) => acc + val, 0);
            const average = sum / numericValues.length;
            const sorted = [...numericValues].sort((a, b) => a - b);
            const median =
              sorted.length % 2 === 0
                ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                : sorted[Math.floor(sorted.length / 2)];

            analytics.average = average;
            analytics.median = median;
            analytics.min = Math.min(...numericValues);
            analytics.max = Math.max(...numericValues);

            const valueCounts: Record<string, number> = {};
            numericValues.forEach((val) => {
              const key = val.toString();
              valueCounts[key] = (valueCounts[key] || 0) + 1;
            });

            analytics.distribution = Object.entries(valueCounts)
              .map(([value, count]) => ({
                value: parseFloat(value),
                count,
                percentage: totalAnswers > 0 ? (count / totalAnswers) * 100 : 0,
              }))
              .sort((a, b) => a.value - b.value);
          }
        }

        // Number fields
        if (field.fieldType === 'NUMBER') {
          const numericValues = answers
            .map((a) => parseFloat(a.value))
            .filter((v) => !Number.isNaN(v));

          if (numericValues.length > 0) {
            const sum = numericValues.reduce((acc, val) => acc + val, 0);
            analytics.average = sum / numericValues.length;
            analytics.min = Math.min(...numericValues);
            analytics.max = Math.max(...numericValues);
            analytics.sum = sum;
          }
        }

        // Text fields
        if (field.fieldType === 'SHORT_TEXT' || field.fieldType === 'LONG_TEXT') {
          const textAnswers = answers.filter((a) => a.value && a.value.trim().length > 0);
          const lengths = textAnswers.map((a) => a.value.length);

          if (lengths.length > 0) {
            analytics.avgLength = lengths.reduce((acc, len) => acc + len, 0) / lengths.length;
            analytics.minLength = Math.min(...lengths);
            analytics.maxLength = Math.max(...lengths);
          }
        }

        return analytics;
      })
    );

    res.json({ fields: fieldAnalytics });
  } catch (error) {
    console.error('Field analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch field analytics' });
  }
});

// Export responses as CSV
router.get('/:formId/export/csv', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const form = await prisma.form.findFirst({
      where: {
        id: req.params.formId,
        ownerId: userId,
        isDeleted: false,
      },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!form) {
      res.status(404).json({ error: 'Form not found' });
      return;
    }

    const responses = await prisma.formResponse.findMany({
      where: { formId: req.params.formId },
      include: {
        answers: {
          include: {
            field: true,
          },
        },
        responder: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const csvData = responses.map((response) => {
      const row: Record<string, string> = {
        'Response ID': response.id,
        'Submitted At': response.submittedAt.toISOString(),
        'Responder Name': response.responderName || response.responder?.name || 'Anonymous',
        'Responder Email': response.responderEmail || response.responder?.email || '',
        'Is Starred': response.isStarred ? 'Yes' : 'No',
        'Is Flagged': response.isFlagged ? 'Yes' : 'No',
      };

      form.fields.forEach((field) => {
        const answer = response.answers.find((a) => a.fieldId === field.id);
        row[field.label] = answer?.value || '';
      });

      return row;
    });

    const fields = [
      'Response ID',
      'Submitted At',
      'Responder Name',
      'Responder Email',
      'Is Starred',
      'Is Flagged',
      ...form.fields.map((f) => f.label),
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(csvData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${form.title.replace(/[^a-z0-9]/gi, '_')}_responses.csv"`
    );

    res.send(csv);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Failed to export responses' });
  }
});

// Export responses as JSON
router.get('/:formId/export/json', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const form = await prisma.form.findFirst({
      where: {
        id: req.params.formId,
        ownerId: userId,
        isDeleted: false,
      },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!form) {
      res.status(404).json({ error: 'Form not found' });
      return;
    }

    const responses = await prisma.formResponse.findMany({
      where: { formId: req.params.formId },
      include: {
        answers: {
          include: {
            field: true,
          },
        },
        responder: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${form.title.replace(/[^a-z0-9]/gi, '_')}_responses.json"`
    );

    res.json({
      form: {
        id: form.id,
        title: form.title,
        description: form.description,
        createdAt: form.createdAt,
        fields: form.fields.map((f) => ({
          id: f.id,
          label: f.label,
          fieldType: f.fieldType,
          isRequired: f.isRequired,
        })),
      },
      responses: responses.map((r) => ({
        id: r.id,
        submittedAt: r.submittedAt,
        responder: {
          name: r.responderName || r.responder?.name,
          email: r.responderEmail || r.responder?.email,
        },
        isStarred: r.isStarred,
        isFlagged: r.isFlagged,
        answers: r.answers.reduce((acc, answer) => {
          acc[answer.field.label] = answer.value;
          return acc;
        }, {} as Record<string, string>),
      })),
      exportedAt: new Date().toISOString(),
      totalResponses: responses.length,
    });
  } catch (error) {
    console.error('Export JSON error:', error);
    res.status(500).json({ error: 'Failed to export responses' });
  }
});

export default router;
