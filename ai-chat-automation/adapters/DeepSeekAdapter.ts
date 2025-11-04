import { chromium } from 'playwright';
import { BaseChatAdapter, ChatAdapterConfig } from '../types';

export class DeepSeekAdapter extends BaseChatAdapter {
  constructor(config: ChatAdapterConfig) {
    super(config, 'DeepSeek');
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

    await this.page.goto('https://chat.deepseek.com/', {
      waitUntil: 'networkidle',
      timeout: this.config.timeout,
    });

    await this.sleep(2000);

    // Find and click login button
    const loginSelectors = [
      'button:has-text("Sign In")',
      'button:has-text("Login")',
      'button:has-text("登录")',
      'a[href*="login"]',
      '[class*="login"]',
    ];

    for (const selector of loginSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.click(selector);
        await this.sleep(2000);
        break;
      } catch (e) {
        continue;
      }
    }

    // Enter email
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="邮箱"]',
    ];

    for (const selector of emailSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.fill(selector, this.config.credentials.email);
        break;
      } catch (e) {
        continue;
      }
    }

    await this.sleep(1000);

    // Enter password
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
    ];

    for (const selector of passwordSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.fill(selector, this.config.credentials.password);
        break;
      } catch (e) {
        continue;
      }
    }

    await this.sleep(1000);

    // Click submit
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("Login")',
      'button:has-text("登录")',
    ];

    for (const selector of submitSelectors) {
      try {
        await this.page.click(selector);
        break;
      } catch (e) {
        continue;
      }
    }

    await this.sleep(4000);
    return true;
  }

  async navigateToChat(): Promise<boolean> {
    if (!this.page) throw new Error('Page not initialized');
    
    // Check if we're already on chat page
    const url = this.page.url();
    if (!url.includes('/chat')) {
      try {
        await this.page.goto('https://chat.deepseek.com/chat', {
          waitUntil: 'networkidle',
          timeout: this.config.timeout,
        });
      } catch (e) {
        // Already on chat page
      }
    }
    
    await this.sleep(2000);
    return true;
  }

  async sendMessage(message: string): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    const inputSelectors = [
      'textarea[placeholder*="Send a message"]',
      'textarea[placeholder*="输入消息"]',
      'textarea[placeholder*="Type a message"]',
      'textarea',
      'input[type="text"]',
      '[contenteditable="true"]',
    ];

    let messageSent = false;

    for (const selector of inputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.fill(selector, message);
        
        // Try Enter key
        await this.page.press(selector, 'Enter');
        messageSent = true;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!messageSent) {
      // Try clicking send button
      const sendButtonSelectors = [
        'button:has-text("Send")',
        'button:has-text("发送")',
        'button[type="submit"]',
        '[aria-label="Send"]',
      ];

      for (const selector of sendButtonSelectors) {
        try {
          await this.page.click(selector);
          messageSent = true;
          break;
        } catch (e) {
          continue;
        }
      }
    }

    if (!messageSent) {
      throw new Error('Could not send message');
    }

    await this.sleep(6000);
    return await this.getResponse();
  }

  async getResponse(): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    // Wait for response to complete
    await this.sleep(8000);

    const responseSelectors = [
      '[data-role="assistant"]',
      '[class*="assistant-message"]',
      '[class*="ai-message"]',
      '.message-content:last-of-type',
      '[class*="response"]',
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

    // Fallback: get all message content
    const messages = await this.page.$$('[class*="message"]');
    if (messages.length > 1) {
      const lastMessage = messages[messages.length - 1];
      const text = await lastMessage.textContent();
      return text || 'No response';
    }

    return 'Could not extract response';
  }
}

