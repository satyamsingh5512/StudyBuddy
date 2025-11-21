import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';
import { testWebhook } from '../utils/webhooks';

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

const prisma = new PrismaClient();
const router = Router();

// Get webhook configuration
router.get('/:formId/config', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
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
      select: {
        webhookUrl: true,
        webhookEnabled: true,
        webhookEvents: true,
      },
    });

    if (!form) {
      res.status(404).json({ error: 'Form not found' });
      return;
    }

    res.json(form);
  } catch (error) {
    console.error('Get webhook config error:', error);
    res.status(500).json({ error: 'Failed to get webhook configuration' });
  }
});

// Update webhook configuration
router.patch('/:formId/config', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { webhookUrl, webhookEnabled, webhookEvents } = req.body;

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

    // Validate webhook URL if provided
    if (webhookUrl && !webhookUrl.match(/^https?:\/\/.+/)) {
      res.status(400).json({ error: 'Invalid webhook URL format' });
      return;
    }

    const updated = await prisma.form.update({
      where: { id: req.params.formId },
      data: {
        webhookUrl: webhookUrl || null,
        webhookEnabled: webhookEnabled ?? form.webhookEnabled,
        webhookEvents: webhookEvents || form.webhookEvents,
      },
      select: {
        webhookUrl: true,
        webhookEnabled: true,
        webhookEvents: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update webhook config error:', error);
    res.status(500).json({ error: 'Failed to update webhook configuration' });
  }
});

// Test webhook
router.post('/:formId/test', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { url } = req.body;

    if (!url || !url.match(/^https?:\/\/.+/)) {
      res.status(400).json({ error: 'Invalid webhook URL' });
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

    const result = await testWebhook(url);
    res.json(result);
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

// Get webhook logs
router.get('/:formId/logs', isAuthenticated, async (req: Request, res: Response): Promise<void> => {
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

    const logs = await prisma.webhookLog.findMany({
      where: { formId: req.params.formId },
      orderBy: { createdAt: 'desc' },
      take: 50, // Last 50 logs
    });

    res.json(logs);
  } catch (error) {
    console.error('Get webhook logs error:', error);
    res.status(500).json({ error: 'Failed to get webhook logs' });
  }
});

export default router;
