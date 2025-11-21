import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

const router = Router();
const prisma = new PrismaClient();

// ============================================
// PUBLIC FORM VIEWING & SUBMISSION
// ============================================

// Get public form details (no auth required)
router.get('/public/:identifier', async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier } = req.params;

    const form = await prisma.form.findFirst({
      where: {
        OR: [{ id: identifier }, { customSlug: identifier }],
        isDeleted: false,
      },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            fields: {
              orderBy: { order: 'asc' },
            },
          },
        },
        fields: {
          where: { sectionId: null },
          orderBy: { order: 'asc' },
        },
        owner: {
          select: {
            name: true,
            avatar: true,
          },
        },
      },
    });

    if (!form) {
      res.status(404).json({ error: 'Form not found' });
      return;
    }

    // Don't expose sensitive info
    const publicForm = {
      id: form.id,
      title: form.title,
      description: form.description,
      heroBadge: form.heroBadge,
      isAcceptingResponses: form.isAcceptingResponses,
      accessType: form.accessType,
      primaryColor: form.primaryColor,
      accentColor: form.accentColor,
      logoUrl: form.logoUrl,
      confirmationMessage: form.confirmationMessage,
      allowMultipleSubmissions: form.allowMultipleSubmissions,
      sections: form.sections,
      fields: form.fields,
      creator: form.owner,
    };

    res.json(publicForm);
  } catch (error) {
    console.error('Fetch public form error:', error);
    res.status(500).json({ error: 'Failed to fetch form' });
  }
});

// Submit form response (public or authenticated)
router.post('/public/:identifier/submit', async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier } = req.params;
    const { answers, responderEmail, responderName } = req.body;

    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    const form = await prisma.form.findFirst({
      where: {
        OR: [{ id: identifier }, { customSlug: identifier }],
        isDeleted: false,
      },
      include: {
        fields: true,
      },
    });

    if (!form) {
      res.status(404).json({ error: 'Form not found' });
      return;
    }

    if (!form.isAcceptingResponses) {
      res.status(403).json({ error: 'This form is no longer accepting responses' });
      return;
    }

    // Check access restrictions
    if (form.accessType === 'AUTHENTICATED' && !userId) {
      res.status(401).json({ error: 'Login required to submit this form' });
      return;
    }

    if (form.accessType === 'DOMAIN_LIMITED' && form.allowedDomain) {
      const email = userId ? authReq.user?.email : responderEmail;
      if (!email || !email.endsWith(`@${form.allowedDomain}`)) {
        res.status(403).json({ error: `Only users from ${form.allowedDomain} can submit` });
        return;
      }
    }

    if (!answers || typeof answers !== 'object') {
      res.status(400).json({ error: 'Invalid answers format' });
      return;
    }

    // Check required fields
    const requiredFields = form.fields.filter((f) => f.isRequired);
    for (const field of requiredFields) {
      if (!answers[field.id] || answers[field.id].toString().trim().length === 0) {
        res.status(400).json({
          error: `Field "${field.label}" is required`,
          fieldId: field.id,
        });
        return;
      }
    }

    // Validate field values
    for (const field of form.fields) {
      const value = answers[field.id];
      if (value === undefined || value === null || value === '') continue;

      const config = field.config as Record<string, unknown> | null;

      // Number validation
      if (field.fieldType === 'NUMBER' && config) {
        const num = parseFloat(value);
        if (Number.isNaN(num)) {
          res.status(400).json({
            error: `Field "${field.label}" must be a number`,
            fieldId: field.id,
          });
          return;
        }
        if (config.min !== undefined && num < (config.min as number)) {
          res.status(400).json({
            error: `Field "${field.label}" must be at least ${config.min}`,
            fieldId: field.id,
          });
          return;
        }
        if (config.max !== undefined && num > (config.max as number)) {
          res.status(400).json({
            error: `Field "${field.label}" must be at most ${config.max}`,
            fieldId: field.id,
          });
          return;
        }
      }

      // Text length validation
      if (
        (field.fieldType === 'SHORT_TEXT' || field.fieldType === 'LONG_TEXT') &&
        config &&
        typeof value === 'string'
      ) {
        if (config.minLength && value.length < (config.minLength as number)) {
          res.status(400).json({
            error: `Field "${field.label}" must be at least ${config.minLength} characters`,
            fieldId: field.id,
          });
          return;
        }
        if (config.maxLength && value.length > (config.maxLength as number)) {
          res.status(400).json({
            error: `Field "${field.label}" must be at most ${config.maxLength} characters`,
            fieldId: field.id,
          });
          return;
        }
      }
    }

    // Basic spam control
    if (!form.allowMultipleSubmissions) {
      const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;

      const recentSubmission = await prisma.formResponse.findFirst({
        where: {
          formId: form.id,
          ...(userId ? { responderUserId: userId } : { ipAddress }),
          submittedAt: {
            gte: new Date(Date.now() - 60 * 1000), // Within last minute
          },
        },
      });

      if (recentSubmission) {
        res.status(429).json({ error: 'Please wait before submitting again' });
        return;
      }
    }

    // Create response
    const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
    const userAgent = req.headers['user-agent'] || null;

    const response = await prisma.formResponse.create({
      data: {
        formId: form.id,
        responderUserId: userId || null,
        responderEmail: responderEmail || null,
        responderName: responderName || null,
        ipAddress,
        userAgent,
        answers: {
          create: Object.entries(answers).map(([fieldId, value]) => ({
            fieldId,
            value: typeof value === 'string' ? value : JSON.stringify(value),
          })),
        },
      },
      include: {
        answers: true,
      },
    });

    res.status(201).json({
      success: true,
      responseId: response.id,
      message: form.confirmationMessage || 'Thank you for your response!',
    });
  } catch (error) {
    console.error('Submit response error:', error);
    res.status(500).json({ error: 'Failed to submit response' });
  }
});

// ============================================
// RESPONSE MANAGEMENT (Protected)
// ============================================

// Get all responses for a form (owner only)
router.get('/:formId', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
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

    const { page = '1', limit = '50', search, startDate, endDate, starred, flagged } = req.query;
    const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

    const where: Record<string, unknown> = { formId: req.params.formId };

    if (startDate || endDate) {
      where.submittedAt = {};
      if (startDate) {
        (where.submittedAt as Record<string, unknown>).gte = new Date(startDate as string);
      }
      if (endDate) {
        (where.submittedAt as Record<string, unknown>).lte = new Date(endDate as string);
      }
    }

    if (starred === 'true') {
      where.isStarred = true;
    }

    if (flagged === 'true') {
      where.isFlagged = true;
    }

    const [responses, total] = await Promise.all([
      prisma.formResponse.findMany({
        where,
        include: {
          answers: {
            include: {
              field: {
                select: {
                  label: true,
                  fieldType: true,
                },
              },
            },
          },
          responder: {
            select: {
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: parseInt(limit as string, 10),
      }),
      prisma.formResponse.count({ where }),
    ]);

    let filteredResponses = responses;
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      filteredResponses = responses.filter((r) =>
        r.answers.some((a) => a.value.toLowerCase().includes(searchLower))
      );
    }

    res.json({
      responses: filteredResponses,
      total,
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      pages: Math.ceil(total / parseInt(limit as string, 10)),
    });
  } catch (error) {
    console.error('Fetch responses error:', error);
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
});

// Get single response
router.get(
  '/:formId/:responseId',
  isAuthenticated,
  async (req: Request, res: Response): Promise<void> => {
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

      const response = await prisma.formResponse.findFirst({
        where: {
          id: req.params.responseId,
          formId: req.params.formId,
        },
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
              avatar: true,
            },
          },
        },
      });

      if (!response) {
        res.status(404).json({ error: 'Response not found' });
        return;
      }

      res.json(response);
    } catch (error) {
      console.error('Fetch response error:', error);
      res.status(500).json({ error: 'Failed to fetch response' });
    }
  }
);

// Delete response
router.delete(
  '/:formId/:responseId',
  isAuthenticated,
  async (req: Request, res: Response): Promise<void> => {
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

      await prisma.formResponse.delete({
        where: { id: req.params.responseId },
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Delete response error:', error);
      res.status(500).json({ error: 'Failed to delete response' });
    }
  }
);

// Toggle star/flag on response
router.patch(
  '/:formId/:responseId/toggle',
  isAuthenticated,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { field } = req.body;

      if (field !== 'isStarred' && field !== 'isFlagged') {
        res.status(400).json({ error: 'Invalid field' });
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

      const response = await prisma.formResponse.findUnique({
        where: { id: req.params.responseId },
      });

      if (!response) {
        res.status(404).json({ error: 'Response not found' });
        return;
      }

      const updated = await prisma.formResponse.update({
        where: { id: req.params.responseId },
        data: { [field]: !response[field as keyof typeof response] },
      });

      res.json(updated);
    } catch (error) {
      console.error('Toggle response field error:', error);
      res.status(500).json({ error: 'Failed to update response' });
    }
  }
);

export default router;
