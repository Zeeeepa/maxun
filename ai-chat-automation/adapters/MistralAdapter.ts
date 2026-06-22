import { chromium } from 'playwright';
import { BaseChatAdapter, ChatAdapterConfig } from '../types';

export class MistralAdapter extends BaseChatAdapter {
  constructor(config: ChatAdapterConfig) {
    super(config, 'Mistral');
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

    await this.page.goto('https://chat.mistral.ai/', {
      waitUntil: 'networkidle',
      timeout: this.config.timeout,
    });

    await this.sleep(2000);

    // Find and click login
    const loginSelectors = [
      'button:has-text("Sign in")',
      'button:has-text("Login")',
      'a:has-text("Sign in")',
      '[data-testid="login"]',
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

    // Check if we need to click "Continue" before password
    const continueButton = await this.page.$('button:has-text("Continue")');
    if (continueButton) {
      await continueButton.click();
      await this.sleep(2000);
    }

    // Fill password
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

    // Submit login
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign in")',
      'button:has-text("Login")',
      'button:has-text("Continue")',
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
    
    // Ensure on chat page
    const url = this.page.url();
    if (!url.includes('chat.mistral.ai')) {
      await this.page.goto('https://chat.mistral.ai/', {
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
      'textarea[placeholder*="Ask anything"]',
      'textarea[placeholder*="Type a message"]',
      'textarea[placeholder*="message"]',
      'textarea',
      'input[type="text"]',
      '[contenteditable="true"]',
    ];

    let sent = false;
    for (const selector of inputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.fill(selector, message);
        
        // Try Enter key
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
        'button[aria-label="Send message"]',
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
      throw new Error('Could not send message to Mistral');
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
      '[class*="assistant"]',
      '[class*="ai-message"]',
      '[class*="bot-response"]',
      'div[class*="message"]:last-child',
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

    // Fallback approach
    const allMessages = await this.page.$$('[class*="message"]');
    if (allMessages.length > 1) {
      const lastMessage = allMessages[allMessages.length - 1];
      const text = await lastMessage.textContent();
      return text || 'No response';
    }

    return 'Could not extract Mistral response';
  }
}

