import { chromium } from 'playwright';
import { BaseChatAdapter, ChatAdapterConfig } from '../types';

export class QwenAdapter extends BaseChatAdapter {
  constructor(config: ChatAdapterConfig) {
    super(config, 'Qwen');
  }

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1280, height: 720 });
  }

  async login(): Promise<boolean> {
    if (!this.page) throw new Error('Page not initialized');

    await this.page.goto('https://chat.qwen.ai/', {
      waitUntil: 'networkidle',
      timeout: this.config.timeout,
    });

    await this.sleep(2000);

    // Look for login button
    const loginSelectors = [
      'button:has-text("登录")',
      'button:has-text("Login")',
      'button:has-text("Sign In")',
      'a:has-text("登录")',
      '[class*="login"]',
    ];

    for (const selector of loginSelectors) {
      try {
        const element = await this.page.waitForSelector(selector, { timeout: 5000 });
        if (element) {
          await element.click();
          break;
        }
      } catch (e) {
        continue;
      }
    }

    await this.sleep(2000);

    // Fill credentials
    await this.retry(async () => {
      const emailInput = await this.page!.waitForSelector(
        'input[type="email"], input[name="email"], input[placeholder*="邮箱"], input[placeholder*="email" i]',
        { timeout: 5000 }
      );
      await emailInput.fill(this.config.credentials.email);
    });

    await this.retry(async () => {
      const passwordInput = await this.page!.waitForSelector(
        'input[type="password"]',
        { timeout: 5000 }
      );
      await passwordInput.fill(this.config.credentials.password);
    });

    // Submit login
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("登录")',
      'button:has-text("Login")',
      'button:has-text("Sign In")',
    ];

    for (const selector of submitSelectors) {
      try {
        await this.page.click(selector);
        break;
      } catch (e) {
        continue;
      }
    }

    await this.sleep(3000);
    return true;
  }

  async navigateToChat(): Promise<boolean> {
    if (!this.page) throw new Error('Page not initialized');
    await this.sleep(2000);
    return true;
  }

  async sendMessage(message: string): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    const inputSelectors = [
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="message" i]',
      'textarea',
      'input[type="text"]',
      '[contenteditable="true"]',
    ];

    for (const selector of inputSelectors) {
      try {
        const input = await this.page.waitForSelector(selector, { timeout: 5000 });
        await input.fill(message);
        
        // Try multiple send methods
        try {
          await this.page.press(selector, 'Enter');
        } catch (e) {
          // Try clicking send button
          const sendButton = await this.page.$('button[type="submit"], button:has-text("发送"), button:has-text("Send")');
          if (sendButton) {
            await sendButton.click();
          }
        }
        
        await this.sleep(5000);
        const response = await this.getResponse();
        return response;
      } catch (e) {
        continue;
      }
    }

    throw new Error('Could not send message');
  }

  async getResponse(): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    // Wait for response
    await this.sleep(8000);

    const responseSelectors = [
      '[data-message-role="assistant"]',
      '[class*="assistant"]',
      '[class*="response"]',
      '.message:last-child',
    ];

    for (const selector of responseSelectors) {
      try {
        const elements = await this.page.$$(selector);
        if (elements.length > 0) {
          const lastElement = elements[elements.length - 1];
          const text = await lastElement.textContent();
          if (text && text.trim().length > 0) {
            return text.trim();
          }
        }
      } catch (e) {
        continue;
      }
    }

    // Fallback
    const messages = await this.page.$$('[class*="message"]');
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const text = await lastMessage.textContent();
      return text || 'No response';
    }

    return 'Could not extract response';
  }
}

