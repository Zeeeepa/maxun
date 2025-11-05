import { Router, Request, Response } from 'express';
import { requireAPIKey } from '../middlewares/api';
import { chromium, Page, Browser, BrowserContext } from 'playwright';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import logger from '../logger';

const router = Router();

/**
 * Universal Chat Automation - Works with ANY website
 * Dynamically detects login forms and chat interfaces
 */

interface ChatRequest {
  url: string; // Target website URL
  email: string; // Login email/username
  password: string; // Login password
  message: string; // Message to send to chat
  stream?: boolean; // Whether to stream response
}

interface ElementDetectionResult {
  loginButton?: string;
  emailInput?: string;
  passwordInput?: string;
  submitButton?: string;
  messageInput?: string;
  sendButton?: string;
  responseContainer?: string;
}

/**
 * AI-powered element detection using heuristics and pattern matching
 * Finds login and chat interface elements on any website
 */
async function detectPageElements(page: Page): Promise<ElementDetectionResult> {
  const elements = await page.evaluate(() => {
    const result: any = {};

    // Helper: Get element selector
    const getSelector = (element: Element): string => {
      if (element.id) return `#${element.id}`;
      if (element.className) {
        const classes = element.className.split(' ').filter(c => c.length > 0);
        if (classes.length > 0) return `.${classes[0]}`;
      }
      return element.tagName.toLowerCase();
    };

    // Helper: Check if element is visible
    const isVisible = (element: HTMLElement): boolean => {
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             style.opacity !== '0';
    };

    // Detect login button
    const loginButtons = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'))
      .filter((el): el is HTMLElement => {
        if (!isVisible(el)) return false;
        const text = el.textContent?.toLowerCase() || '';
        const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
        const className = el.className.toLowerCase();
        const id = el.id.toLowerCase();
        
        return (
          text.includes('login') || text.includes('sign in') || text.includes('log in') ||
          ariaLabel.includes('login') || ariaLabel.includes('sign in') ||
          className.includes('login') || className.includes('signin') ||
          id.includes('login') || id.includes('signin')
        );
      });
    
    if (loginButtons.length > 0) {
      result.loginButton = getSelector(loginButtons[0]);
    }

    // Detect email/username input
    const emailInputs = Array.from(document.querySelectorAll('input'))
      .filter((el): el is HTMLInputElement => {
        if (!isVisible(el)) return false;
        const type = el.type.toLowerCase();
        const name = (el.name || '').toLowerCase();
        const id = (el.id || '').toLowerCase();
        const placeholder = (el.placeholder || '').toLowerCase();
        const autocomplete = (el.autocomplete || '').toLowerCase();
        
        return (
          type === 'email' ||
          type === 'text' && (
            name.includes('email') || name.includes('username') || name.includes('user') ||
            id.includes('email') || id.includes('username') || id.includes('user') ||
            placeholder.includes('email') || placeholder.includes('username') ||
            autocomplete.includes('email') || autocomplete.includes('username')
          )
        );
      });
    
    if (emailInputs.length > 0) {
      result.emailInput = getSelector(emailInputs[0]);
    }

    // Detect password input
    const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]'))
      .filter((el): el is HTMLInputElement => isVisible(el));
    
    if (passwordInputs.length > 0) {
      result.passwordInput = getSelector(passwordInputs[0]);
    }

    // Detect submit button (for login form)
    const submitButtons = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"]'))
      .filter((el): el is HTMLElement => {
        if (!isVisible(el)) return false;
        const text = el.textContent?.toLowerCase() || '';
        return text.includes('sign in') || text.includes('login') || text.includes('submit') || text.includes('continue');
      });
    
    if (submitButtons.length > 0) {
      result.submitButton = getSelector(submitButtons[0]);
    }

    // Detect chat message input (textarea or input)
    const messageInputs = Array.from(document.querySelectorAll('textarea, input[type="text"]'))
      .filter((el): el is HTMLTextAreaElement | HTMLInputElement => {
        if (!isVisible(el)) return false;
        const placeholder = (el.placeholder || '').toLowerCase();
        const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
        const className = el.className.toLowerCase();
        const id = el.id.toLowerCase();
        
        return (
          placeholder.includes('message') || placeholder.includes('chat') || placeholder.includes('type') ||
          ariaLabel.includes('message') || ariaLabel.includes('chat') ||
          className.includes('message') || className.includes('chat') || className.includes('input') ||
          id.includes('message') || id.includes('chat') || id.includes('prompt')
        );
      });
    
    if (messageInputs.length > 0) {
      result.messageInput = getSelector(messageInputs[0]);
    }

    // Detect send button
    const sendButtons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'))
      .filter((el): el is HTMLElement => {
        if (!isVisible(el)) return false;
        const text = el.textContent?.toLowerCase() || '';
        const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
        const className = el.className.toLowerCase();
        
        return (
          text.includes('send') || text === 'submit' || text === '→' || text === '➤' ||
          ariaLabel.includes('send') || ariaLabel.includes('submit') ||
          className.includes('send') || className.includes('submit')
        );
      });
    
    if (sendButtons.length > 0) {
      result.sendButton = getSelector(sendButtons[0]);
    }

    // Detect response container (where chat messages appear)
    const responseContainers = Array.from(document.querySelectorAll('div, section, article'))
      .filter((el): el is HTMLElement => {
        if (!isVisible(el)) return false;
        const className = el.className.toLowerCase();
        const id = el.id.toLowerCase();
        const role = el.getAttribute('role')?.toLowerCase() || '';
        
        return (
          className.includes('message') || className.includes('chat') || className.includes('response') ||
          id.includes('message') || id.includes('chat') || id.includes('response') ||
          role.includes('log') || role === 'main'
        );
      });
    
    if (responseContainers.length > 0) {
      result.responseContainer = getSelector(responseContainers[0]);
    }

    return result;
  });

  logger.log('info', `Detected elements: ${JSON.stringify(elements)}`);
  return elements;
}

/**
 * Perform login on any website
 */
async function performLogin(
  page: Page,
  elements: ElementDetectionResult,
  email: string,
  password: string
): Promise<void> {
  try {
    // Click login button if present (some sites have modal/overlay)
    if (elements.loginButton) {
      try {
        await page.click(elements.loginButton, { timeout: 5000 });
        await page.waitForTimeout(2000); // Wait for modal to appear
      } catch (error) {
        logger.log('warn', 'Login button click failed, assuming already on login page');
      }
    }

    // Re-detect elements after potential page change
    const loginElements = await detectPageElements(page);

    // Fill email/username
    if (loginElements.emailInput) {
      await page.fill(loginElements.emailInput, email, { timeout: 5000 });
      await page.waitForTimeout(500);
    } else {
      throw new Error('Email input not found');
    }

    // Fill password
    if (loginElements.passwordInput) {
      await page.fill(loginElements.passwordInput, password, { timeout: 5000 });
      await page.waitForTimeout(500);
    } else {
      throw new Error('Password input not found');
    }

    // Click submit
    if (loginElements.submitButton) {
      await page.click(loginElements.submitButton, { timeout: 5000 });
    } else {
      // Fallback: press Enter in password field
      await page.press(loginElements.passwordInput!, 'Enter');
    }

    // Wait for navigation or page load
    await page.waitForTimeout(3000);
    
    logger.log('info', 'Login completed');
  } catch (error: any) {
    logger.log('error', `Login failed: ${error.message}`);
    throw new Error(`Login failed: ${error.message}`);
  }
}

/**
 * Send message and extract response from chat interface
 */
async function sendChatMessage(
  page: Page,
  elements: ElementDetectionResult,
  message: string
): Promise<string> {
  try {
    // Re-detect elements on current page
    const chatElements = await detectPageElements(page);

    // Type message
    if (chatElements.messageInput) {
      await page.fill(chatElements.messageInput, message, { timeout: 5000 });
      await page.waitForTimeout(500);
    } else {
      throw new Error('Message input not found');
    }

    // Click send button
    if (chatElements.sendButton) {
      await page.click(chatElements.sendButton, { timeout: 5000 });
    } else {
      // Fallback: press Enter
      await page.press(chatElements.messageInput!, 'Enter');
    }

    // Wait for response to appear
    await page.waitForTimeout(5000);

    // Extract response
    let response = '';
    if (chatElements.responseContainer) {
      response = await page.evaluate((selector) => {
        const container = document.querySelector(selector);
        if (!container) return '';
        
        // Get last message (assuming newest is last)
        const messages = Array.from(container.querySelectorAll('[class*="message"], [class*="response"], p, div'))
          .filter((el) => {
            const text = el.textContent?.trim() || '';
            return text.length > 0 && text.length < 5000; // Filter out noise
          });
        
        if (messages.length > 0) {
          return messages[messages.length - 1].textContent?.trim() || '';
        }
        
        return container.textContent?.trim() || '';
      }, chatElements.responseContainer);
    }

    // Fallback: get all text from body
    if (!response || response.length === 0) {
      response = await page.evaluate(() => {
        return document.body.innerText || '';
      });
    }

    logger.log('info', `Extracted response: ${response.substring(0, 200)}...`);
    return response;
  } catch (error: any) {
    logger.log('error', `Send message failed: ${error.message}`);
    throw new Error(`Send message failed: ${error.message}`);
  }
}

/**
 * POST /api/v1/universal/chat
 * Universal chat automation for any website
 */
router.post(
  '/v1/universal/chat',
  requireAPIKey,
  async (req: Request, res: Response) => {
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    
    try {
      const { url, email, password, message, stream = false } = req.body as ChatRequest;

      // Validate request
      if (!url || !email || !password || !message) {
        return res.status(400).json({
          error: {
            message: 'Missing required fields: url, email, password, message',
            type: 'invalid_request_error',
          },
        });
      }

      logger.log('info', `Starting universal chat automation for: ${url}`);

      // Launch browser with stealth mode
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      });

      const page = await context.newPage();

      // Navigate to target URL
      logger.log('info', `Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Detect page elements
      logger.log('info', 'Detecting page elements...');
      const elements = await detectPageElements(page);

      // Perform login
      logger.log('info', 'Attempting login...');
      await performLogin(page, elements, email, password);

      // Wait for chat interface to load
      await page.waitForTimeout(3000);

      // Send message and get response
      logger.log('info', 'Sending chat message...');
      const response = await sendChatMessage(page, elements, message);

      // Close browser
      await browser.close();

      // Return OpenAI-compatible response
      const openAIResponse = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'universal',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: response || 'No response extracted',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: Math.ceil(message.length / 4),
          completion_tokens: Math.ceil((response?.length || 0) / 4),
          total_tokens: Math.ceil((message.length + (response?.length || 0)) / 4),
        },
      };

      logger.log('info', 'Universal chat completed successfully');
      return res.json(openAIResponse);

    } catch (error: any) {
      logger.log('error', `Universal chat error: ${error.message}`);
      
      // Clean up browser
      if (browser) {
        await browser.close().catch(() => {});
      }

      return res.status(500).json({
        error: {
          message: error.message || 'Internal server error',
          type: 'api_error',
          details: error.stack,
        },
      });
    }
  }
);

/**
 * POST /api/v1/universal/detect
 * Test endpoint to detect elements on a page without executing
 */
router.post(
  '/v1/universal/detect',
  requireAPIKey,
  async (req: Request, res: Response) => {
    let browser: Browser | null = null;
    
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({
          error: { message: 'URL is required', type: 'invalid_request_error' },
        });
      }

      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const elements = await detectPageElements(page);

      await browser.close();

      return res.json({
        url,
        detected_elements: elements,
        has_login_form: !!(elements.emailInput && elements.passwordInput),
        has_chat_interface: !!(elements.messageInput && elements.sendButton),
      });

    } catch (error: any) {
      if (browser) await browser.close().catch(() => {});
      
      return res.status(500).json({
        error: { message: error.message, type: 'api_error' },
      });
    }
  }
);

export default router;

