import { K2ThinkAdapter } from './adapters/K2ThinkAdapter';
import { QwenAdapter } from './adapters/QwenAdapter';
import { DeepSeekAdapter } from './adapters/DeepSeekAdapter';
import { GrokAdapter } from './adapters/GrokAdapter';
import { ZAiAdapter } from './adapters/ZAiAdapter';
import { MistralAdapter } from './adapters/MistralAdapter';
import { BaseChatAdapter, ChatAdapterConfig, ChatResponse } from './types';
import * as dotenv from 'dotenv';

dotenv.config();

export interface PlatformConfig {
  name: string;
  email: string;
  password: string;
  enabled: boolean;
}

export class ChatOrchestrator {
  private platforms: Map<string, BaseChatAdapter> = new Map();
  private config: {
    headless: boolean;
    timeout: number;
  };

  constructor() {
    this.config = {
      headless: process.env.HEADLESS === 'true',
      timeout: parseInt(process.env.TIMEOUT || '30000'),
    };
    
    this.initializePlatforms();
  }

  private initializePlatforms(): void {
    const platformConfigs: PlatformConfig[] = [
      {
        name: 'K2Think',
        email: process.env.K2THINK_EMAIL || '',
        password: process.env.K2THINK_PASSWORD || '',
        enabled: !!(process.env.K2THINK_EMAIL && process.env.K2THINK_PASSWORD),
      },
      {
        name: 'Qwen',
        email: process.env.QWEN_EMAIL || '',
        password: process.env.QWEN_PASSWORD || '',
        enabled: !!(process.env.QWEN_EMAIL && process.env.QWEN_PASSWORD),
      },
      {
        name: 'DeepSeek',
        email: process.env.DEEPSEEK_EMAIL || '',
        password: process.env.DEEPSEEK_PASSWORD || '',
        enabled: !!(process.env.DEEPSEEK_EMAIL && process.env.DEEPSEEK_PASSWORD),
      },
      {
        name: 'Grok',
        email: process.env.GROK_EMAIL || '',
        password: process.env.GROK_PASSWORD || '',
        enabled: !!(process.env.GROK_EMAIL && process.env.GROK_PASSWORD),
      },
      {
        name: 'ZAi',
        email: process.env.ZAI_EMAIL || '',
        password: process.env.ZAI_PASSWORD || '',
        enabled: !!(process.env.ZAI_EMAIL && process.env.ZAI_PASSWORD),
      },
      {
        name: 'Mistral',
        email: process.env.MISTRAL_EMAIL || '',
        password: process.env.MISTRAL_PASSWORD || '',
        enabled: !!(process.env.MISTRAL_EMAIL && process.env.MISTRAL_PASSWORD),
      },
    ];

    platformConfigs.forEach((platformConfig) => {
      if (platformConfig.enabled) {
        const config: ChatAdapterConfig = {
          credentials: {
            email: platformConfig.email,
            password: platformConfig.password,
          },
          headless: this.config.headless,
          timeout: this.config.timeout,
        };

        let adapter: BaseChatAdapter;
        switch (platformConfig.name) {
          case 'K2Think':
            adapter = new K2ThinkAdapter(config);
            break;
          case 'Qwen':
            adapter = new QwenAdapter(config);
            break;
          case 'DeepSeek':
            adapter = new DeepSeekAdapter(config);
            break;
          case 'Grok':
            adapter = new GrokAdapter(config);
            break;
          case 'ZAi':
            adapter = new ZAiAdapter(config);
            break;
          case 'Mistral':
            adapter = new MistralAdapter(config);
            break;
          default:
            return;
        }

        this.platforms.set(platformConfig.name, adapter);
      }
    });
  }

  /**
   * Send message to a specific platform
   */
  async sendToPlat form(platformName: string, message: string): Promise<ChatResponse> {
    const adapter = this.platforms.get(platformName);
    if (!adapter) {
      return {
        platform: platformName,
        success: false,
        error: `Platform ${platformName} not found or not configured`,
        timestamp: new Date(),
        duration: 0,
      };
    }

    try {
      return await adapter.chat(message);
    } catch (error) {
      return {
        platform: platformName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        duration: 0,
      };
    }
  }

  /**
   * Send message to all configured platforms
   */
  async sendToAll(message: string): Promise<ChatResponse[]> {
    const promises = Array.from(this.platforms.keys()).map((platformName) =>
      this.sendToPlatform(platformName, message)
    );

    return await Promise.all(promises);
  }

  /**
   * Send message to all platforms sequentially (slower but more stable)
   */
  async sendToAllSequential(message: string): Promise<ChatResponse[]> {
    const results: ChatResponse[] = [];
    
    for (const platformName of this.platforms.keys()) {
      const result = await this.sendToPlatform(platformName, message);
      results.push(result);
    }

    return results;
  }

  /**
   * Get list of available platforms
   */
  getAvailablePlatforms(): string[] {
    return Array.from(this.platforms.keys());
  }

  /**
   * Check if a platform is configured
   */
  isPlatformAvailable(platformName: string): boolean {
    return this.platforms.has(platformName);
  }
}

