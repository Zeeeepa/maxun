import { Browser, Page } from 'playwright';

export interface ChatCredentials {
  email: string;
  password: string;
}

export interface ChatMessage {
  content: string;
  timestamp: Date;
  sender: 'user' | 'assistant';
}

export interface ChatResponse {
  platform: string;
  success: boolean;
  message?: string;
  response?: string;
  error?: string;
  timestamp: Date;
  duration: number;
}

export interface ChatAdapterConfig {
  credentials: ChatCredentials;
  headless?: boolean;
  timeout?: number;
  retryAttempts?: number;
}

export abstract class BaseChatAdapter {
  protected browser: Browser | null = null;
  protected page: Page | null = null;
  protected config: ChatAdapterConfig;
  protected platformName: string;

  constructor(config: ChatAdapterConfig, platformName: string) {
    this.config = {
      headless: true,
      timeout: 30000,
      retryAttempts: 3,
      ...config,
    };
    this.platformName = platformName;
  }

  /**
   * Initialize browser and page
   */
  abstract initialize(): Promise<void>;

  /**
   * Login to the platform
   */
  abstract login(): Promise<boolean>;

  /**
   * Navigate to chat interface
   */
  abstract navigateToChat(): Promise<boolean>;

  /**
   * Send a message to the chat
   */
  abstract sendMessage(message: string): Promise<string>;

  /**
   * Get the response from the chat
   */
  abstract getResponse(): Promise<string>;

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Execute full chat flow
   */
  async chat(message: string): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      await this.initialize();
      await this.login();
      await this.navigateToChat();
      const response = await this.sendMessage(message);
      
      return {
        platform: this.platformName,
        success: true,
        message,
        response,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        platform: this.platformName,
        success: false,
        message,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Retry wrapper for operations
   */
  protected async retry<T>(
    operation: () => Promise<T>,
    attempts: number = this.config.retryAttempts || 3
  ): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === attempts - 1) throw error;
        await this.sleep(1000 * (i + 1)); // Exponential backoff
      }
    }
    throw new Error('All retry attempts failed');
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for selector with timeout
   */
  protected async waitForSelector(
    selector: string,
    options?: { timeout?: number }
  ): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    await this.page.waitForSelector(selector, {
      timeout: options?.timeout || this.config.timeout,
    });
  }
}

