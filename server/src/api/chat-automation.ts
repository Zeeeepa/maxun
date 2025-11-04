import { Router, Request, Response } from 'express';
import { requireAPIKey } from '../middlewares/api';
import path from 'path';

const router = Router();

// Dynamically import the ChatOrchestrator (will be available when ai-chat-automation is built)
let ChatOrchestrator: any;
try {
  const modulePath = path.join(__dirname, '../../../ai-chat-automation/ChatOrchestrator');
  ChatOrchestrator = require(modulePath).ChatOrchestrator;
} catch (error) {
  console.warn('ChatOrchestrator not found. Run `cd ai-chat-automation && npm install && npm run build`');
}

/**
 * @swagger
 * /api/chat/platforms:
 *   get:
 *     summary: Get available chat platforms
 *     description: Returns a list of all configured AI chat platforms
 *     security:
 *       - api_key: []
 *     responses:
 *       200:
 *         description: List of available platforms
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 platforms:
 *                   type: array
 *                   items:
 *                     type: string
 *                 count:
 *                   type: number
 *       500:
 *         description: Server error
 */
router.get('/platforms', requireAPIKey, async (req: Request, res: Response) => {
  try {
    if (!ChatOrchestrator) {
      return res.status(503).json({
        success: false,
        error: 'Chat automation module not available. Please build ai-chat-automation first.',
      });
    }

    const orchestrator = new ChatOrchestrator();
    const platforms = orchestrator.getAvailablePlatforms();

    res.json({
      success: true,
      platforms,
      count: platforms.length,
    });
  } catch (error) {
    console.error('Error getting platforms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get platforms',
    });
  }
});

/**
 * @swagger
 * /api/chat/send:
 *   post:
 *     summary: Send message to specific platform
 *     description: Send a message to a specific AI chat platform
 *     security:
 *       - api_key: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - platform
 *               - message
 *             properties:
 *               platform:
 *                 type: string
 *                 example: "K2Think"
 *               message:
 *                 type: string
 *                 example: "how are you"
 *     responses:
 *       200:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 platform:
 *                   type: string
 *                 message:
 *                   type: string
 *                 response:
 *                   type: string
 *                 duration:
 *                   type: number
 *                 timestamp:
 *                   type: string
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post('/send', requireAPIKey, async (req: Request, res: Response) => {
  try {
    if (!ChatOrchestrator) {
      return res.status(503).json({
        success: false,
        error: 'Chat automation module not available',
      });
    }

    const { platform, message } = req.body;

    if (!platform || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: platform and message',
      });
    }

    const orchestrator = new ChatOrchestrator();
    
    if (!orchestrator.isPlatformAvailable(platform)) {
      return res.status(400).json({
        success: false,
        error: `Platform "${platform}" not found or not configured`,
        availablePlatforms: orchestrator.getAvailablePlatforms(),
      });
    }

    const result = await orchestrator.sendToPlatform(platform, message);

    res.json(result);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    });
  }
});

/**
 * @swagger
 * /api/chat/send-all:
 *   post:
 *     summary: Send message to all platforms
 *     description: Send a message to all configured AI chat platforms
 *     security:
 *       - api_key: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 example: "how are you"
 *               sequential:
 *                 type: boolean
 *                 default: false
 *                 description: If true, sends messages sequentially instead of in parallel
 *     responses:
 *       200:
 *         description: Messages sent to all platforms
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       platform:
 *                         type: string
 *                       success:
 *                         type: boolean
 *                       response:
 *                         type: string
 *                       duration:
 *                         type: number
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     successful:
 *                       type: number
 *                     failed:
 *                       type: number
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post('/send-all', requireAPIKey, async (req: Request, res: Response) => {
  try {
    if (!ChatOrchestrator) {
      return res.status(503).json({
        success: false,
        error: 'Chat automation module not available',
      });
    }

    const { message, sequential = false } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: message',
      });
    }

    const orchestrator = new ChatOrchestrator();
    const results = sequential
      ? await orchestrator.sendToAllSequential(message)
      : await orchestrator.sendToAll(message);

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    res.json({
      success: true,
      message,
      results,
      summary: {
        total: results.length,
        successful,
        failed,
      },
    });
  } catch (error) {
    console.error('Error sending to all platforms:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send messages',
    });
  }
});

export default router;

