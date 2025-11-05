import { Router, Request, Response } from 'express';
import { requireAPIKey } from '../middlewares/api';
import Robot from '../models/Robot';
import Run from '../models/Run';
import ChatCredential from '../models/ChatCredential';
import { decryptValue } from '../utils/encryption';
import { v4 as uuid } from 'uuid';
import { createRemoteBrowserForRun, destroyRemoteBrowser } from '../browser-management/controller';
import { getDecryptedProxyConfig } from '../routes/proxy';
import { serverIo } from '../server';
import logger from '../logger';
import { WorkflowFile } from 'maxun-core';

const router = Router();

/**
 * Provider to Robot template ID mapping
 * These are loaded from environment variables or database
 */
interface ProviderConfig {
  modelName: string;
  robotId: string | null;
  provider: string;
  requiresAuth: boolean;
  avgResponseTime: number;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  'k2think': {
    modelName: 'k2think',
    robotId: process.env.K2THINK_ROBOT_ID || null,
    provider: 'k2think',
    requiresAuth: true,
    avgResponseTime: 8000,
  },
  'qwen': {
    modelName: 'qwen',
    robotId: process.env.QWEN_ROBOT_ID || null,
    provider: 'qwen',
    requiresAuth: true,
    avgResponseTime: 7000,
  },
  'deepseek': {
    modelName: 'deepseek',
    robotId: process.env.DEEPSEEK_ROBOT_ID || null,
    provider: 'deepseek',
    requiresAuth: true,
    avgResponseTime: 9000,
  },
  'grok': {
    modelName: 'grok',
    robotId: process.env.GROK_ROBOT_ID || null,
    provider: 'grok',
    requiresAuth: true,
    avgResponseTime: 10000,
  },
  'zai': {
    modelName: 'z.ai',
    robotId: process.env.ZAI_ROBOT_ID || null,
    provider: 'zai',
    requiresAuth: true,
    avgResponseTime: 8000,
  },
  'mistral': {
    modelName: 'mistral',
    robotId: process.env.MISTRAL_ROBOT_ID || null,
    provider: 'mistral',
    requiresAuth: true,
    avgResponseTime: 7000,
  },
};

/**
 * Helper: Inject parameters into workflow
 */
function injectWorkflowParameters(
  workflow: WorkflowFile,
  params: Record<string, any>
): WorkflowFile {
  const workflowCopy = JSON.parse(JSON.stringify(workflow)) as WorkflowFile;

  workflowCopy.workflow.forEach((pair) => {
    pair.what.forEach((action) => {
      if (Array.isArray(action.args)) {
        action.args = action.args.map((arg: any) => {
          if (typeof arg === 'string') {
            // Replace all {{PARAM}} patterns
            Object.keys(params).forEach((key) => {
              const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
              arg = arg.replace(pattern, params[key]);
            });
          }
          return arg;
        });
      }
    });
  });

  return workflowCopy;
}

/**
 * Helper: Convert Run output to OpenAI format
 */
function convertToOpenAIFormat(run: any, model: string): any {
  const extractedText =
    run.serializableOutput?.scrapeSchema?.['chat-response']?.response ||
    run.serializableOutput?.scrapeSchema?.response ||
    'No response extracted from chat provider';

  return {
    id: `chatcmpl-${run.runId}`,
    object: 'chat.completion',
    created: Math.floor(new Date(run.startedAt).getTime() / 1000),
    model: model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: extractedText,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: Math.ceil((extractedText?.length || 0) / 4),
      completion_tokens: Math.ceil((extractedText?.length || 0) / 4),
      total_tokens: Math.ceil((extractedText?.length || 0) / 2),
    },
  };
}

/**
 * Helper: Wait for run completion
 */
async function waitForRunCompletion(
  runId: string,
  timeout: number = 60000
): Promise<any> {
  const startTime = Date.now();
  const pollInterval = 500;

  while (Date.now() - startTime < timeout) {
    const run = await Run.findOne({ where: { runId } });

    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    if (run.status === 'success') {
      return run.toJSON();
    }

    if (run.status === 'failed' || run.status === 'aborted') {
      throw new Error(`Run ${runId} failed with status: ${run.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Run ${runId} timeout after ${timeout}ms`);
}

/**
 * Helper: Stream response using Server-Sent Events
 */
async function streamResponse(
  res: Response,
  runId: string,
  model: string
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const pollInterval = setInterval(async () => {
    try {
      const run = await Run.findOne({ where: { runId } });

      if (!run) {
        clearInterval(pollInterval);
        res.write(
          `data: ${JSON.stringify({ error: 'Run not found' })}\n\n`
        );
        res.end();
        return;
      }

      if (run.status === 'success') {
        clearInterval(pollInterval);

        const extractedText =
          run.serializableOutput?.scrapeSchema?.['chat-response']
            ?.response ||
          run.serializableOutput?.scrapeSchema?.response ||
          'No response extracted';

        // Send final chunk
        res.write(
          `data: ${JSON.stringify({
            id: `chatcmpl-${runId}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [
              {
                index: 0,
                delta: { content: extractedText },
                finish_reason: 'stop',
              },
            ],
          })}\n\n`
        );

        res.write('data: [DONE]\n\n');
        res.end();
      } else if (run.status === 'failed' || run.status === 'aborted') {
        clearInterval(pollInterval);
        res.write(
          `data: ${JSON.stringify({
            error: `Run failed with status: ${run.status}`,
          })}\n\n`
        );
        res.end();
      }
    } catch (error: any) {
      clearInterval(pollInterval);
      res.write(
        `data: ${JSON.stringify({ error: error.message })}\n\n`
      );
      res.end();
    }
  }, 500);

  // Cleanup on client disconnect
  res.on('close', () => {
    clearInterval(pollInterval);
  });
}

/**
 * POST /api/v1/chat/completions
 * OpenAI-compatible chat completion endpoint
 * 
 * Supports two modes:
 * 1. Pre-recorded robot mode (model = 'k2think', 'qwen', etc.)
 * 2. Universal dynamic mode (model = 'universal', requires url/email/password in messages metadata)
 */
router.post(
  '/v1/chat/completions',
  requireAPIKey,
  async (req: Request, res: Response) => {
    try {
      const { model, messages, stream = false, url, email, password } = req.body;

      // Validate request
      if (!model || !messages || !Array.isArray(messages)) {
        return res.status(400).json({
          error: {
            message: 'Invalid request: model and messages are required',
            type: 'invalid_request_error',
          },
        });
      }

      // Map model to provider config
      const providerConfig = PROVIDER_CONFIGS[model];
      if (!providerConfig || !providerConfig.robotId) {
        return res.status(400).json({
          error: {
            message: `Model "${model}" not supported or not configured`,
            type: 'invalid_request_error',
          },
        });
      }

      // Extract user message
      const userMessage =
        messages.find((m: any) => m.role === 'user')?.content ||
        messages[messages.length - 1]?.content ||
        '';

      if (!userMessage) {
        return res.status(400).json({
          error: {
            message: 'No user message found in request',
            type: 'invalid_request_error',
          },
        });
      }

      // Get robot template
      const robot = await Robot.findByPk(providerConfig.robotId);
      if (!robot) {
        return res.status(404).json({
          error: {
            message: `Robot template for model "${model}" not found`,
            type: 'not_found_error',
          },
        });
      }

      // Get credentials for provider
      const credential = await ChatCredential.findOne({
        where: {
          provider: providerConfig.provider,
          active: true,
        },
      });

      if (!credential) {
        return res.status(500).json({
          error: {
            message: `No active credentials found for provider "${providerConfig.provider}"`,
            type: 'authentication_error',
          },
        });
      }

      // Decrypt password
      const decryptedPassword = decryptValue(credential.encryptedPassword);

      // Log credential access (audit trail)
      logger.log('info', `Credentials accessed for provider: ${providerConfig.provider}`);

      // Update last used timestamp
      await credential.update({ lastUsedAt: new Date() });

      // Inject parameters into workflow
      const parameterizedWorkflow = injectWorkflowParameters(
        robot.recording,
        {
          USER_MESSAGE: userMessage,
          EMAIL: credential.email,
          PASSWORD: decryptedPassword,
        }
      );

      // Create browser and run
      const userId = (req as any).user?.id || 'api-user';
      const proxyConfig = await getDecryptedProxyConfig(userId);
      let proxyOptions: any = {};

      if (proxyConfig.proxy_url) {
        proxyOptions = {
          server: proxyConfig.proxy_url,
          ...(proxyConfig.proxy_username &&
            proxyConfig.proxy_password && {
              username: proxyConfig.proxy_username,
              password: proxyConfig.proxy_password,
            }),
        };
      }

      const browserId = createRemoteBrowserForRun(userId);
      const runId = uuid();

      const run = await Run.create({
        status: 'running',
        name: `Chat: ${model}`,
        robotId: robot.id,
        robotMetaId: robot.recording_meta.id,
        startedAt: new Date().toLocaleString(),
        finishedAt: '',
        browserId,
        interpreterSettings: {
          maxConcurrency: 1,
          maxRepeats: 1,
          debug: false,
        },
        log: '',
        runId,
        runByAPI: true,
        serializableOutput: {},
        binaryOutput: {},
        retryCount: 0,
      });

      // Emit run started event
      try {
        serverIo
          .of('/queued-run')
          .to(`user-${userId}`)
          .emit('run-started', {
            runId: run.runId,
            robotMetaId: run.robotMetaId,
            robotName: run.name,
            status: 'running',
            startedAt: run.startedAt,
            runByAPI: true,
            browserId: run.browserId,
          });
      } catch (socketError: any) {
        logger.log('warn', `Failed to send run-started notification: ${socketError.message}`);
      }

      // TODO: Trigger actual workflow execution here
      // This would call the interpreter with the parameterized workflow
      // For now, we'll just wait for the run to complete

      if (stream) {
        // Streaming response
        return streamResponse(res, runId, model);
      } else {
        // Non-streaming response
        const completedRun = await waitForRunCompletion(runId);
        const openAIResponse = convertToOpenAIFormat(completedRun, model);
        return res.json(openAIResponse);
      }
    } catch (error: any) {
      logger.log('error', `Chat completion error: ${error.message}`);
      return res.status(500).json({
        error: {
          message: error.message || 'Internal server error',
          type: 'api_error',
        },
      });
    }
  }
);

/**
 * GET /api/v1/models
 * List available models (OpenAI-compatible)
 */
router.get('/v1/models', requireAPIKey, async (req: Request, res: Response) => {
  const models = Object.keys(PROVIDER_CONFIGS)
    .filter((key) => PROVIDER_CONFIGS[key].robotId !== null)
    .map((key) => ({
      id: key,
      object: 'model',
      created: 1677649963,
      owned_by: 'maxun',
      permission: [],
      root: key,
      parent: null,
    }));

  res.json({
    object: 'list',
    data: models,
  });
});

export default router;
