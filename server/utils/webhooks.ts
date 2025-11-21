import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface WebhookPayload {
  event: string;
  formId: string;
  responseId?: string;
  data: any;
  timestamp: string;
}

interface WebhookConfig {
  url: string;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Send webhook with exponential backoff retry logic
 */
export async function sendWebhook(
  config: WebhookConfig,
  payload: WebhookPayload,
  attemptNumber: number = 1
): Promise<{
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
}> {
  const maxRetries = config.maxRetries || 3;
  const timeout = config.timeout || 10000; // 10 seconds

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'StudyBuddy-Webhooks/1.0',
        'X-StudyBuddy-Event': payload.event,
        'X-StudyBuddy-Delivery-Attempt': attemptNumber.toString(),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseBody = await response.text();

    if (response.ok) {
      return {
        success: true,
        statusCode: response.status,
        responseBody: responseBody.substring(0, 1000), // Limit to 1000 chars
      };
    } else {
      // Non-2xx status code
      if (attemptNumber < maxRetries) {
        // Retry with exponential backoff
        const delay = Math.pow(2, attemptNumber) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delay));
        return sendWebhook(config, payload, attemptNumber + 1);
      } else {
        return {
          success: false,
          statusCode: response.status,
          responseBody: responseBody.substring(0, 1000),
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    }
  } catch (error: any) {
    // Network error or timeout
    if (attemptNumber < maxRetries) {
      // Retry with exponential backoff
      const delay = Math.pow(2, attemptNumber) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendWebhook(config, payload, attemptNumber + 1);
    } else {
      return {
        success: false,
        error: error.message || 'Network error',
      };
    }
  }
}

/**
 * Log webhook attempt to database
 */
export async function logWebhook(
  formId: string,
  url: string,
  event: string,
  payload: WebhookPayload,
  result: {
    success: boolean;
    statusCode?: number;
    responseBody?: string;
    error?: string;
  },
  attemptNumber: number,
  responseId?: string
): Promise<void> {
  try {
    await prisma.webhookLog.create({
      data: {
        formId,
        responseId,
        url,
        event,
        payload: JSON.stringify(payload),
        statusCode: result.statusCode,
        responseBody: result.responseBody,
        error: result.error,
        attemptNumber,
      },
    });
  } catch (error) {
    console.error('Failed to log webhook:', error);
  }
}

/**
 * Send webhook for form event (main function)
 */
export async function triggerWebhook(
  formId: string,
  event: string,
  data: any,
  responseId?: string
): Promise<void> {
  try {
    // Get form webhook configuration
    const form = await prisma.form.findUnique({
      where: { id: formId },
      select: {
        webhookUrl: true,
        webhookEnabled: true,
        webhookEvents: true,
      },
    });

    if (!form || !form.webhookEnabled || !form.webhookUrl) {
      return; // Webhook not configured or disabled
    }

    // Check if this event should trigger webhook
    if (!form.webhookEvents.includes(event)) {
      return;
    }

    // Prepare payload
    const payload: WebhookPayload = {
      event,
      formId,
      responseId,
      data,
      timestamp: new Date().toISOString(),
    };

    // Send webhook
    const result = await sendWebhook(
      { url: form.webhookUrl },
      payload
    );

    // Log the attempt
    await logWebhook(
      formId,
      form.webhookUrl,
      event,
      payload,
      result,
      1,
      responseId
    );

    if (!result.success) {
      console.error(`Webhook failed for form ${formId}:`, result.error);
    }
  } catch (error) {
    console.error('Error triggering webhook:', error);
  }
}

/**
 * Test webhook endpoint
 */
export async function testWebhook(
  url: string
): Promise<{
  success: boolean;
  statusCode?: number;
  responseTime?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'StudyBuddy-Webhooks/1.0',
        'X-StudyBuddy-Event': 'webhook.test',
      },
      body: JSON.stringify({
        event: 'webhook.test',
        message: 'This is a test webhook from StudyBuddy Forms',
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        success: true,
        statusCode: response.status,
        responseTime,
      };
    } else {
      return {
        success: false,
        statusCode: response.status,
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: error.message || 'Network error',
    };
  }
}
