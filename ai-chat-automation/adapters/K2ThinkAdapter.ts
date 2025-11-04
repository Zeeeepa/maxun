import { chromium } from 'playwright';
import { BaseChatAdapter, ChatAdapterConfig } from '../types';

export class K2ThinkAdapter extends BaseChatAdapter {
  constructor(config: ChatAdapterConfig) {
    super(config, 'K2Think');
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

    await this.page.goto('https://www.k2think.ai/', {
      waitUntil: 'networkidle',
      timeout: this.config.timeout,
    });

    // Wait for and click login/sign in button
    const loginSelectors = [
      'button:has-text("Sign In")',
      'button:has-text("Login")',
      'a:has-text("Sign In")',
      '[data-testid="login-button"]',
    ];

    for (const selector of loginSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.click(selector);
        break;
      } catch (e) {
        continue;
      }
    }

    await this.sleep(2000);

    // Fill in credentials
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

    // Click submit button
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("Login")',
    ];

    for (const selector of submitSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
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
    
    // Wait for chat interface to load
    await this.sleep(2000);
    return true;
  }

  async sendMessage(message: string): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    // Find and fill chat input
    const inputSelectors = [
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="type" i]',
      'input[placeholder*="message" i]',
      'textarea',
      '[contenteditable="true"]',
    ];

    for (const selector of inputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.fill(selector, message);
        
        // Try to send with Enter key or button click
        await this.page.press(selector, 'Enter');
        await this.sleep(2000);
        
        // Wait for response
        const response = await this.getResponse();
        return response;
      } catch (e) {
        continue;
      }
    }

    throw new Error('Could not find chat input');
  }

  async getResponse(): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    // Wait for response to appear
    await this.sleep(5000);

    const responseSelectors = [
      '[data-role="assistant"]',
      '.message-assistant',
      '.assistant-message',
      '.response',
    ];

    for (const selector of responseSelectors) {
      try {
        const elements = await this.page.$$(selector);
        if (elements.length > 0) {
          const lastElement = elements[elements.length - 1];
          const text = await lastElement.textContent();
          return text || 'No response text';
        }
      } catch (e) {
        continue;
      }
    }

    // Fallback: get all text content
    const bodyText = await this.page.textContent('body');
    return bodyText || 'Could not extract response';
  }
}

