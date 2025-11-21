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

// Get all sections for a form
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

    const sections = await prisma.formSection.findMany({
      where: { formId: req.params.formId },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { fields: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    res.json(sections);
  } catch (error) {
    console.error('Fetch sections error:', error);
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
});

// Create new section
router.post('/', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { formId, title, description, order } = req.body;

    if (!formId || !title) {
      res.status(400).json({ error: 'Form ID and title are required' });
      return;
    }

    const hasAccess = await verifyFormOwnership(formId, userId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    let sectionOrder = order;
    if (sectionOrder === undefined) {
      const lastSection = await prisma.formSection.findFirst({
        where: { formId },
        orderBy: { order: 'desc' },
      });
      sectionOrder = lastSection ? lastSection.order + 1 : 0;
    }

    const section = await prisma.formSection.create({
      data: {
        formId,
        title,
        description: description || null,
        order: sectionOrder,
      },
      include: {
        fields: true,
      },
    });

    res.status(201).json(section);
  } catch (error) {
    console.error('Create section error:', error);
    res.status(500).json({ error: 'Failed to create section' });
  }
});

// Update section
router.patch('/:id', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const section = await prisma.formSection.findUnique({
      where: { id: req.params.id },
      include: { form: true },
    });

    if (!section) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }

    if (section.form.ownerId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const allowedFields = ['title', 'description', 'order'];
    const updateData: Record<string, unknown> = {};

    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const updated = await prisma.formSection.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update section error:', error);
    res.status(500).json({ error: 'Failed to update section' });
  }
});

// Bulk reorder sections
router.post('/reorder', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { formId, sections } = req.body;

    if (!formId || !Array.isArray(sections)) {
      res.status(400).json({ error: 'Form ID and sections array are required' });
      return;
    }

    const hasAccess = await verifyFormOwnership(formId, userId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await prisma.$transaction(
      sections.map((section: { id: string; order: number }) =>
        prisma.formSection.update({
          where: { id: section.id },
          data: { order: section.order },
        })
      )
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder sections error:', error);
    res.status(500).json({ error: 'Failed to reorder sections' });
  }
});

// Delete section
router.delete('/:id', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { moveFieldsToRoot } = req.query;

    const section = await prisma.formSection.findUnique({
      where: { id: req.params.id },
      include: {
        form: true,
        fields: true,
      },
    });

    if (!section) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }

    if (section.form.ownerId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (moveFieldsToRoot === 'true' && section.fields.length > 0) {
      await prisma.formField.updateMany({
        where: { sectionId: req.params.id },
        data: { sectionId: null },
      });
    }

    await prisma.formSection.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({ error: 'Failed to delete section' });
  }
});

export default router;
