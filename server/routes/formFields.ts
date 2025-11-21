import { Router, Request, Response } from 'express';
import { PrismaClient, FieldType } from '@prisma/client';
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

// Helper to verify form ownership
async function verifyFormOwnership(formId: string, userId: string): Promise<boolean> {
  const form = await prisma.form.findFirst({
    where: {
      id: formId,
      ownerId: userId,
      isDeleted: false,
    },
  });
  return !!form;
}

// Get all fields for a form
router.get('/form/:formId', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const hasAccess = await verifyFormOwnership(req.params.formId, userId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const fields = await prisma.formField.findMany({
      where: { formId: req.params.formId },
      include: {
        section: {
          select: { id: true, title: true, order: true },
        },
      },
      orderBy: [{ sectionId: 'asc' }, { order: 'asc' }],
    });

    res.json(fields);
  } catch (error) {
    console.error('Fetch fields error:', error);
    res.status(500).json({ error: 'Failed to fetch fields' });
  }
});

// Create new field
router.post('/', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { formId, sectionId, label, description, helpText, fieldType, isRequired, order, config, logic } = req.body;

    if (!formId || !label || !fieldType) {
      res.status(400).json({ error: 'Form ID, label, and field type are required' });
      return;
    }

    const hasAccess = await verifyFormOwnership(formId, userId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Calculate order if not provided
    let fieldOrder = order;
    if (fieldOrder === undefined) {
      const lastField = await prisma.formField.findFirst({
        where: { formId, sectionId: sectionId || null },
        orderBy: { order: 'desc' },
      });
      fieldOrder = lastField ? lastField.order + 1 : 0;
    }

    const field = await prisma.formField.create({
      data: {
        formId,
        sectionId: sectionId || null,
        label,
        description: description || null,
        helpText: helpText || null,
        fieldType: fieldType as FieldType,
        isRequired: isRequired || false,
        order: fieldOrder,
        config: config || null,
        logic: logic || null,
      },
    });

    res.status(201).json(field);
  } catch (error) {
    console.error('Create field error:', error);
    res.status(500).json({ error: 'Failed to create field' });
  }
});

// Update field
router.patch('/:id', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const field = await prisma.formField.findUnique({
      where: { id: req.params.id },
      include: { form: true },
    });

    if (!field) {
      res.status(404).json({ error: 'Field not found' });
      return;
    }

    if (field.form.ownerId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const allowedFields = [
      'label',
      'description',
      'helpText',
      'fieldType',
      'isRequired',
      'sectionId',
      'order',
      'config',
      'logic',
    ];

    const updateData: Record<string, unknown> = {};

    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const updated = await prisma.formField.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(updated);
  } catch (error) {
    console.error('Update field error:', error);
    res.status(500).json({ error: 'Failed to update field' });
  }
});

// Bulk reorder fields
router.post('/reorder', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { formId, fields } = req.body;

    if (!formId || !Array.isArray(fields)) {
      res.status(400).json({ error: 'Form ID and fields array are required' });
      return;
    }

    const hasAccess = await verifyFormOwnership(formId, userId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await prisma.$transaction(
      fields.map((field: { id: string; order: number; sectionId?: string | null }) =>
        prisma.formField.update({
          where: { id: field.id },
          data: { 
            order: field.order,
            ...(field.sectionId !== undefined && { sectionId: field.sectionId }),
          },
        })
      )
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder fields error:', error);
    res.status(500).json({ error: 'Failed to reorder fields' });
  }
});

// Duplicate field
router.post('/:id/duplicate', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const original = await prisma.formField.findUnique({
      where: { id: req.params.id },
      include: { form: true },
    });

    if (!original) {
      res.status(404).json({ error: 'Field not found' });
      return;
    }

    if (original.form.ownerId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const lastField = await prisma.formField.findFirst({
      where: { formId: original.formId, sectionId: original.sectionId },
      orderBy: { order: 'desc' },
    });

    const newOrder = lastField ? lastField.order + 1 : 0;

    const duplicate = await prisma.formField.create({
      data: {
        formId: original.formId,
        sectionId: original.sectionId,
        label: `${original.label} (Copy)`,
        description: original.description,
        helpText: original.helpText,
        fieldType: original.fieldType,
        isRequired: original.isRequired,
        order: newOrder,
        config: original.config,
        logic: original.logic,
      },
    });

    res.status(201).json(duplicate);
  } catch (error) {
    console.error('Duplicate field error:', error);
    res.status(500).json({ error: 'Failed to duplicate field' });
  }
});

// Delete field
router.delete('/:id', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const field = await prisma.formField.findUnique({
      where: { id: req.params.id },
      include: { form: true },
    });

    if (!field) {
      res.status(404).json({ error: 'Field not found' });
      return;
    }

    if (field.form.ownerId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await prisma.formField.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete field error:', error);
    res.status(500).json({ error: 'Failed to delete field' });
  }
});

export default router;
