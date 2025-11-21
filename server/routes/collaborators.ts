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

const prisma = new PrismaClient();
const router = Router();

// Get collaborators for a form
router.get('/:formId', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check if user is owner or collaborator
    const form = await prisma.form.findFirst({
      where: {
        id: req.params.formId,
        isDeleted: false,
        OR: [
          { ownerId: userId },
          { collaborators: { some: { userId } } },
        ],
      },
    });

    if (!form) {
      res.status(404).json({ error: 'Form not found or access denied' });
      return;
    }

    const collaborators = await prisma.formCollaborator.findMany({
      where: { formId: req.params.formId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { invitedAt: 'asc' },
    });

    res.json(collaborators);
  } catch (error) {
    console.error('Get collaborators error:', error);
    res.status(500).json({ error: 'Failed to get collaborators' });
  }
});

// Add collaborator
router.post('/:formId', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { userEmail, role } = req.body;

    if (!userEmail || !role) {
      res.status(400).json({ error: 'User email and role are required' });
      return;
    }

    if (!['VIEWER', 'EDITOR', 'ADMIN'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    // Check if user is owner or admin
    const form = await prisma.form.findFirst({
      where: {
        id: req.params.formId,
        isDeleted: false,
        OR: [
          { ownerId: userId },
          { 
            collaborators: { 
              some: { 
                userId,
                role: 'ADMIN',
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

    // Find user by email
    const targetUser = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if already a collaborator
    const existing = await prisma.formCollaborator.findUnique({
      where: {
        formId_userId: {
          formId: req.params.formId,
          userId: targetUser.id,
        },
      },
    });

    if (existing) {
      res.status(400).json({ error: 'User is already a collaborator' });
      return;
    }

    // Add collaborator
    const collaborator = await prisma.formCollaborator.create({
      data: {
        formId: req.params.formId,
        userId: targetUser.id,
        role,
        invitedBy: userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Log activity
    await prisma.formActivityLog.create({
      data: {
        formId: req.params.formId,
        userId,
        action: 'collaborator.added',
        description: `Added ${targetUser.name} as ${role}`,
        metadata: JSON.stringify({ collaboratorId: targetUser.id, role }),
      },
    });

    res.status(201).json(collaborator);
  } catch (error) {
    console.error('Add collaborator error:', error);
    res.status(500).json({ error: 'Failed to add collaborator' });
  }
});

// Update collaborator role
router.patch('/:formId/:collaboratorId', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { role } = req.body;

    if (!role || !['VIEWER', 'EDITOR', 'ADMIN'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    // Check if user is owner or admin
    const form = await prisma.form.findFirst({
      where: {
        id: req.params.formId,
        isDeleted: false,
        OR: [
          { ownerId: userId },
          { 
            collaborators: { 
              some: { 
                userId,
                role: 'ADMIN',
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

    const updated = await prisma.formCollaborator.update({
      where: { id: req.params.collaboratorId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Log activity
    await prisma.formActivityLog.create({
      data: {
        formId: req.params.formId,
        userId,
        action: 'collaborator.role_updated',
        description: `Changed ${updated.user.name}'s role to ${role}`,
        metadata: JSON.stringify({ collaboratorId: updated.userId, newRole: role }),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update collaborator error:', error);
    res.status(500).json({ error: 'Failed to update collaborator' });
  }
});

// Remove collaborator
router.delete('/:formId/:collaboratorId', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check if user is owner or admin
    const form = await prisma.form.findFirst({
      where: {
        id: req.params.formId,
        isDeleted: false,
        OR: [
          { ownerId: userId },
          { 
            collaborators: { 
              some: { 
                userId,
                role: 'ADMIN',
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

    const collaborator = await prisma.formCollaborator.findUnique({
      where: { id: req.params.collaboratorId },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!collaborator) {
      res.status(404).json({ error: 'Collaborator not found' });
      return;
    }

    await prisma.formCollaborator.delete({
      where: { id: req.params.collaboratorId },
    });

    // Log activity
    await prisma.formActivityLog.create({
      data: {
        formId: req.params.formId,
        userId,
        action: 'collaborator.removed',
        description: `Removed ${collaborator.user.name} as collaborator`,
        metadata: JSON.stringify({ collaboratorId: collaborator.userId }),
      },
    });

    res.json({ success: true, message: 'Collaborator removed' });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

// Get activity logs
router.get('/:formId/activity', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check if user is owner or collaborator
    const form = await prisma.form.findFirst({
      where: {
        id: req.params.formId,
        isDeleted: false,
        OR: [
          { ownerId: userId },
          { collaborators: { some: { userId } } },
        ],
      },
    });

    if (!form) {
      res.status(404).json({ error: 'Form not found or access denied' });
      return;
    }

    const logs = await prisma.formActivityLog.findMany({
      where: { formId: req.params.formId },
      orderBy: { createdAt: 'desc' },
      take: 100, // Last 100 activities
    });

    res.json(logs);
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Failed to get activity logs' });
  }
});

export default router;
