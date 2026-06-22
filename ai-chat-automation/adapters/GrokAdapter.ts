import { chromium } from 'playwright';
import { BaseChatAdapter, ChatAdapterConfig } from '../types';

export class GrokAdapter extends BaseChatAdapter {
  constructor(config: ChatAdapterConfig) {
    super(config, 'Grok');
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

    await this.page.goto('https://grok.com/', {
      waitUntil: 'networkidle',
      timeout: this.config.timeout,
    });

    await this.sleep(3000);

    // Grok may require X/Twitter authentication
    const loginSelectors = [
      'button:has-text("Sign in")',
      'button:has-text("Log in")',
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

    // Handle email input
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="text"]', // X/Twitter uses text input
      'input[autocomplete="username"]',
    ];

    for (const selector of emailSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.fill(selector, this.config.credentials.email);
        
        // Try to proceed
        const nextButton = await this.page.$('button:has-text("Next"), button[type="submit"]');
        if (nextButton) {
          await nextButton.click();
          await this.sleep(2000);
        }
        break;
      } catch (e) {
        continue;
      }
    }

    // Handle password input
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

    // Submit login
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Log in")',
      'button:has-text("Sign in")',
      'button[data-testid="LoginForm_Login_Button"]',
    ];

    for (const selector of submitSelectors) {
      try {
        await this.page.click(selector);
        break;
      } catch (e) {
        continue;
      }
    }

    await this.sleep(5000);
    return true;
  }

  async navigateToChat(): Promise<boolean> {
    if (!this.page) throw new Error('Page not initialized');
    
    // Wait for chat interface to load
    await this.sleep(3000);
    
    // Try to navigate to chat if not already there
    const currentUrl = this.page.url();
    if (!currentUrl.includes('grok.com') || !currentUrl.includes('chat')) {
      try {
        await this.page.goto('https://grok.com/', {
          waitUntil: 'networkidle',
          timeout: this.config.timeout,
        });
      } catch (e) {
        // Already on correct page
      }
    }
    
    await this.sleep(2000);
    return true;
  }

  async sendMessage(message: string): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    const inputSelectors = [
      'textarea[placeholder*="Ask Grok"]',
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
        
        // Try Enter key (may not work with Shift+Enter behavior)
        await this.page.keyboard.press('Enter');
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
      throw new Error('Could not send message');
    }

    await this.sleep(7000);
    return await this.getResponse();
  }

  async getResponse(): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    // Wait for response to generate
    await this.sleep(10000);

    const responseSelectors = [
      '[data-role="assistant"]',
      '[class*="assistant"]',
      '[class*="grok-response"]',
      '[class*="ai-message"]',
      'div[class*="message"]:last-child',
    ];

    for (const selector of responseSelectors) {
      try {
        const elements = await this.page.$$(selector);
        if (elements.length > 0) {
          const lastElement = elements[elements.length - 1];
          const text = await lastElement.textContent();
          if (text && text.trim().length > 10) {
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
      return text || 'No response captured';
    }

    return 'Could not extract Grok response';
  }
}

