import { chromium } from 'playwright';
import { BaseChatAdapter, ChatAdapterConfig } from '../types';

export class ZAiAdapter extends BaseChatAdapter {
  constructor(config: ChatAdapterConfig) {
    super(config, 'Z.ai');
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

    await this.page.goto('https://chat.z.ai/', {
      waitUntil: 'networkidle',
      timeout: this.config.timeout,
    });

    await this.sleep(2000);

    // Find login button
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

    // Fill email
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="email" i]',
      'input[autocomplete="email"]',
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

    // Fill password
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[autocomplete="current-password"]',
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

    // Submit
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("Login")',
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
    
    // Ensure we're on chat page
    const url = this.page.url();
    if (!url.includes('chat.z.ai')) {
      await this.page.goto('https://chat.z.ai/', {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });
    }
    
    await this.sleep(2000);
    return true;
  }

  async sendMessage(message: string): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    const inputSelectors = [
      'textarea[placeholder*="message"]',
      'textarea[placeholder*="Type"]',
      'textarea',
      'input[type="text"]',
      '[contenteditable="true"]',
    ];

    let sent = false;
    for (const selector of inputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.fill(selector, message);
        
        // Try pressing Enter
        await this.page.press(selector, 'Enter');
        sent = true;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!sent) {
      // Try send button
      const sendButtonSelectors = [
        'button[aria-label="Send"]',
        'button:has-text("Send")',
        'button[type="submit"]',
      ];

      for (const selector of sendButtonSelectors) {
        try {
          await this.page.click(selector);
          sent = true;
          break;
        } catch (e) {
          continue;
        }
      }
    }

    if (!sent) {
      throw new Error('Could not send message to Z.ai');
    }

    await this.sleep(6000);
    return await this.getResponse();
  }

  async getResponse(): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    // Wait for AI response
    await this.sleep(8000);

    const responseSelectors = [
      '[data-role="assistant"]',
      '[class*="assistant-message"]',
      '[class*="ai-response"]',
      '[class*="bot-message"]',
      'div[class*="message"]:last-of-type',
    ];

    for (const selector of responseSelectors) {
      try {
        const elements = await this.page.$$(selector);
        if (elements.length > 0) {
          const lastElement = elements[elements.length - 1];
          const text = await lastElement.textContent();
          if (text && text.trim().length > 5) {
            return text.trim();
          }
        }
      } catch (e) {
        continue;
      }
    }

    // Fallback
    const allMessages = await this.page.$$('[class*="message"]');
    if (allMessages.length > 1) {
      const lastMessage = allMessages[allMessages.length - 1];
      const text = await lastMessage.textContent();
      return text || 'No response';
    }

    return 'Could not extract Z.ai response';
  }
}

