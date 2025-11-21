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
// FORMS CRUD
// ============================================

// Get all forms for authenticated user
router.get('/', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { archived } = req.query;
    const isArchived = archived === 'true';

    const forms = await prisma.form.findMany({
      where: {
        isDeleted: false,
        ...(isArchived ? { archivedAt: { not: null } } : { archivedAt: null }),
        OR: [
          { ownerId: userId },
          { collaborators: { some: { userId } } },
        ],
      },
      include: {
        _count: {
          select: { responses: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(forms);
  } catch (error) {
    console.error('Fetch forms error:', error);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

// Get single form with full details
router.get('/:id', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const form = await prisma.form.findFirst({
      where: {
        id: req.params.id,
        isDeleted: false,
        OR: [
          { ownerId: userId },
          { collaborators: { some: { userId } } },
        ],
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
        _count: {
          select: { responses: true },
        },
      },
    });

    if (!form) {
      res.status(404).json({ error: 'Form not found' });
      return;
    }

    res.json(form);
  } catch (error) {
    console.error('Fetch form error:', error);
    res.status(500).json({ error: 'Failed to fetch form' });
  }
});

// Create new form
router.post('/', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title, description, heroBadge, accessType, customSlug, primaryColor, accentColor } =
      req.body;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const form = await prisma.form.create({
      data: {
        ownerId: userId,
        title,
        description: description || null,
        heroBadge: heroBadge || null,
        accessType: accessType || 'PUBLIC',
        customSlug: customSlug || null,
        primaryColor: primaryColor || '#6366f1',
        accentColor: accentColor || '#818cf8',
      },
    });

    res.status(201).json(form);
  } catch (error: unknown) {
    console.error('Create form error:', error);
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      res.status(400).json({ error: 'Custom slug already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create form' });
    }
  }
});

// Update form
router.patch('/:id', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify ownership or editor/admin access
    const form = await prisma.form.findFirst({
      where: {
        id: req.params.id,
        isDeleted: false,
        OR: [
          { ownerId: userId },
          { 
            collaborators: { 
              some: { 
                userId,
                role: { in: ['EDITOR', 'ADMIN'] },
              } 
            } 
          },
        ],
      },
    });

    if (!form) {
      res.status(404).json({ error: 'Form not found or insufficient permissions' });
      return;
    }

    const allowedFields = [
      'title',
      'description',
      'heroBadge',
      'customSlug',
      'isAcceptingResponses',
      'accessType',
      'allowedDomain',
      'primaryColor',
      'accentColor',
      'logoUrl',
      'confirmationMessage',
      'allowMultipleSubmissions',
    ];

    const updateData: Record<string, unknown> = {};

    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    // Check custom slug uniqueness
    if (updateData.customSlug && updateData.customSlug !== form.customSlug) {
      const slugExists = await prisma.form.findFirst({
        where: {
          customSlug: updateData.customSlug as string,
          id: { not: req.params.id },
        },
      });

      if (slugExists) {
        res.status(400).json({ error: 'Custom slug already exists' });
        return;
      }
    }

    const updated = await prisma.form.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(updated);
  } catch (error) {
    console.error('Update form error:', error);
    res.status(500).json({ error: 'Failed to update form' });
  }
});

// Toggle accepting responses
router.patch(
  '/:id/toggle-responses',
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
          id: req.params.id,
          ownerId: userId,
          isDeleted: false,
        },
      });

      if (!form) {
        res.status(404).json({ error: 'Form not found' });
        return;
      }

      const updated = await prisma.form.update({
        where: { id: req.params.id },
        data: { isAcceptingResponses: !form.isAcceptingResponses },
      });

      res.json(updated);
    } catch (error) {
      console.error('Toggle responses error:', error);
      res.status(500).json({ error: 'Failed to toggle responses' });
    }
  }
);

// Archive/unarchive form
router.patch('/:id/archive', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const form = await prisma.form.findFirst({
      where: {
        id: req.params.id,
        ownerId: userId,
        isDeleted: false,
      },
    });

    if (!form) {
      res.status(404).json({ error: 'Form not found' });
      return;
    }

    const updated = await prisma.form.update({
      where: { id: req.params.id },
      data: { archivedAt: form.archivedAt ? null : new Date() },
    });

    res.json(updated);
  } catch (error) {
    console.error('Archive form error:', error);
    res.status(500).json({ error: 'Failed to archive form' });
  }
});

// Soft delete form
router.delete('/:id', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const form = await prisma.form.findFirst({
      where: {
        id: req.params.id,
        ownerId: userId,
        isDeleted: false,
      },
    });

    if (!form) {
      res.status(404).json({ error: 'Form not found' });
      return;
    }

    await prisma.form.update({
      where: { id: req.params.id },
      data: { isDeleted: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete form error:', error);
    res.status(500).json({ error: 'Failed to delete form' });
  }
});

// Duplicate form
router.post('/:id/duplicate', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const original = await prisma.form.findFirst({
      where: {
        id: req.params.id,
        ownerId: userId,
        isDeleted: false,
      },
      include: {
        sections: {
          include: {
            fields: true,
          },
        },
        fields: {
          where: { sectionId: null },
        },
      },
    });

    if (!original) {
      res.status(404).json({ error: 'Form not found' });
      return;
    }

    // Create duplicate
    const duplicate = await prisma.form.create({
      data: {
        ownerId: userId,
        title: `${original.title} (Copy)`,
        description: original.description,
        heroBadge: original.heroBadge,
        accessType: original.accessType,
        allowedDomain: original.allowedDomain,
        primaryColor: original.primaryColor,
        accentColor: original.accentColor,
        logoUrl: original.logoUrl,
        confirmationMessage: original.confirmationMessage,
        allowMultipleSubmissions: original.allowMultipleSubmissions,
        isAcceptingResponses: false,
      },
    });

    // Duplicate sections and fields
    const sectionMap = new Map<string, string>();

    await Promise.all(
      original.sections.map(async (section) => {
        const newSection = await prisma.formSection.create({
          data: {
            formId: duplicate.id,
            title: section.title,
            description: section.description,
            order: section.order,
          },
        });

        sectionMap.set(section.id, newSection.id);

        await Promise.all(
          section.fields.map((field) =>
            prisma.formField.create({
              data: {
                formId: duplicate.id,
                sectionId: newSection.id,
                label: field.label,
                description: field.description,
                helpText: field.helpText,
                fieldType: field.fieldType,
                isRequired: field.isRequired,
                order: field.order,
                config: field.config,
                logic: field.logic,
              },
            })
          )
        );
      })
    );

    // Duplicate fields without section
    await Promise.all(
      original.fields.map((field) =>
        prisma.formField.create({
          data: {
            formId: duplicate.id,
            sectionId: null,
            label: field.label,
            description: field.description,
            helpText: field.helpText,
            fieldType: field.fieldType,
            isRequired: field.isRequired,
            order: field.order,
            config: field.config,
            logic: field.logic,
          },
        })
      )
    );

    res.status(201).json(duplicate);
  } catch (error) {
    console.error('Duplicate form error:', error);
    res.status(500).json({ error: 'Failed to duplicate form' });
  }
});

export default router;
