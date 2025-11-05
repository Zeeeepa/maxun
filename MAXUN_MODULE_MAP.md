# 🗺️ Maxun Complete Module Map & Web-to-API Flow Architecture

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Core Module Hierarchy](#core-module-hierarchy)
3. [Entry Points for Web Chat Automation](#entry-points)
4. [Data Flow: Web → OpenAI API](#data-flow)
5. [Implementation Strategy](#implementation-strategy)

---

## 🏗️ System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    MAXUN ARCHITECTURE                    │
├─────────────────────────────────────────────────────────┤
│  Frontend (React/TypeScript)  │  Backend (Express/TS)   │
├───────────────────────────────┼─────────────────────────┤
│  • Recording UI               │  • REST API             │
│  • Browser Renderer           │  • Browser Pool         │
│  • Workflow Editor            │  • Job Queue (PgBoss)   │
│  • Run Dashboard              │  • Workflow Executor    │
└───────────────────────────────┴─────────────────────────┘
         ↓                                 ↓
┌────────────────────────────────────────────────────────┐
│            maxun-core (Workflow Engine)                │
│  • Interpreter: Executes workflow steps                │
│  • Preprocessor: Validates & initializes workflows     │
│  • State Machine: Condition matching (where/what)      │
└────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────┐
│         Playwright (Browser Automation)                │
│  • Headless Chromium                                   │
│  • Stealth mode (anti-detection)                       │
│  • DOM manipulation & scraping                         │
└────────────────────────────────────────────────────────┘
```

---

## 📂 Core Module Hierarchy

### **1. Backend Entry Points**

#### **server/src/server.ts** 🚀 Main Server
```typescript
// PRIMARY ENTRY POINT
// Responsibilities:
// - Express app initialization
// - Socket.io server setup
// - Route registration
// - Browser pool singleton
// - Database connection

Key Exports:
- io: Socket.IO server instance
- browserPool: Global browser pool manager
- app: Express application

Routes Registered:
- /record    → Recording session management
- /workflow  → Workflow CRUD operations
- /storage   → Robot & run data
- /auth      → User authentication
- /webhook   → Event notifications
- /proxy     → Proxy configuration
- /integration → GSheets/Airtable
```

#### **server/src/routes/record.ts** 🎬 Recording API
```typescript
// WORKFLOW RECORDING ENDPOINTS
// Critical for capturing user interactions

Key Endpoints:
- GET  /record/start
  → Creates RemoteBrowser for recording
  → Returns browserId for socket connection
  → Entry point for UI automation recording

- POST /record/interpret
  → Executes recorded workflow
  → Validates & runs automation

- GET  /record/stop
  → Terminates browser session
  → Cleans up resources
```

#### **server/src/api/record.ts** 🤖 Robot Execution API
```typescript
// ROBOT MANAGEMENT & EXECUTION
// OpenAI-compatible API layer here

Key Endpoints:
- GET  /api/robots
  → List all robots (workflows)

- GET  /api/robots/:id
  → Get robot details

- POST /api/robots/:id/runs
  → Execute robot & wait for completion
  → ⭐ THIS IS WHERE WE ADD OPENAI WRAPPER

- GET  /api/robots/:id/runs/:runId
  → Get run results (scraped data)
  → Convert to OpenAI format here
```

---

### **2. Browser Management Layer**

#### **server/src/browser-management/controller.ts** 🎮
```typescript
// BROWSER LIFECYCLE ORCHESTRATOR

Key Functions:
- initializeRemoteBrowserForRecording(userId, mode)
  → Creates browser for UI recording
  → Registers DOM/screenshot listeners
  → Returns browserId

- createRemoteBrowserForRun(userId)
  → Creates browser for workflow execution
  → Reserves slot in pool
  → Async initialization

- destroyRemoteBrowser(browserId, userId)
  → Cleanup & resource release
```

#### **server/src/browser-management/classes/RemoteBrowser.ts** 🌐
```typescript
// SINGLE BROWSER INSTANCE MANAGER

Key Components:
- browser: Playwright Browser instance
- context: BrowserContext (isolated session)
- page: Current Page being automated
- generator: WorkflowGenerator (captures actions)
- interpreter: WorkflowInterpreter (executes workflows)

Key Methods:
- initialize(userId): Promise<void>
  → Launches Chromium with stealth
  → Sets up context & page
  → Registers event handlers

- getCurrentPage(): Promise<Page>
  → Returns active page for automation

- subscribeToDOM() / subscribeToScreencast()
  → Real-time streaming to frontend
```

#### **server/src/browser-management/classes/BrowserPool.ts** 🏊
```typescript
// MANAGES MULTIPLE BROWSER INSTANCES

Key Features:
- User → Browser mapping (1 user : 2 browsers max)
- State management: "recording" | "run"
- Atomic slot reservation
- Stale browser cleanup

Key Methods:
- addRemoteBrowser(id, browser, userId, active, state)
- getRemoteBrowser(id): RemoteBrowser | undefined
- getActiveBrowserId(userId, state?): string | null
```

---

### **3. Workflow Management**

#### **server/src/workflow-management/classes/Generator.ts** ✍️
```typescript
// RECORDS USER ACTIONS INTO WORKFLOW

Key Responsibilities:
- Listen to browser events (click, type, scroll)
- Generate CSS/XPath selectors
- Build WhereWhatPair[] workflow structure
- Handle custom actions (scrape, screenshot)

Event Handlers:
- on('click') → Captures click coordinates & element
- on('type') → Records text input (encrypted)
- on('scrape') → Defines data extraction rules
- on('screenshot') → Captures visual state

Output: WorkflowFile
{
  workflow: WhereWhatPair[] // Array of condition→action pairs
}
```

#### **server/src/workflow-management/classes/Interpreter.ts** ▶️
```typescript
// EXECUTES RECORDED WORKFLOWS

Key Methods:
- InterpretRecording(workflow, page, settings)
  → Runs workflow step-by-step
  → Collects scraped data
  → Handles pagination & scrolling
  → Returns: { serializableOutput, binaryOutput, log }

Data Collection:
- serializableOutput: { scrapeSchema, scrapeList }
- binaryOutput: { screenshots }
- debugMessages: Execution logs
```

#### **maxun-core/src/interpret.ts** 🧠 Core Interpreter
```typescript
// STATE MACHINE EXECUTION ENGINE

Key Algorithm:
while (!workflowComplete) {
  1. Get current page state (URL, cookies, DOM)
  2. Find matching WhereWhatPair (condition check)
  3. Execute "what" actions
  4. Remove completed step from workflow
  5. Loop
}

Custom Actions:
- scrapeSchema(fields) → Extract specific fields
- scrapeList(selector, fields) → Bulk extraction
- screenshot(options) → Visual capture
- scroll(direction) → Pagination handling
```

---

### **4. Job Queue & Scheduling**

#### **server/src/pgboss-worker.ts** 📬
```typescript
// ASYNCHRONOUS JOB PROCESSING

Queues:
- 'initialize-browser-recording'
  → Starts browser for recording
- 'execute-run'
  → Runs robot workflow
- 'destroy-browser'
  → Cleanup

Key Function:
- processRunExecution(job: ExecuteRunData)
  → Retrieves run from DB
  → Gets browser from pool
  → Calls interpreter.InterpretRecording()
  → Saves results to DB
  → Triggers webhooks & integrations
```

#### **server/src/schedule-worker.ts** ⏰
```typescript
// CRON-BASED RECURRING RUNS

Key Function:
- executeRun(robotId, userId)
  → Creates new Run record
  → Executes workflow
  → Updates Run status
  → Triggers integrations (GSheets/Airtable)
```

---

### **5. Data Models**

#### **server/src/models/Robot.ts** 🤖
```typescript
interface Robot {
  id: UUID
  userId: number
  recording_meta: {
    name: string
    id: string
    createdAt: string
    params: any[]
  }
  recording: {
    workflow: WhereWhatPair[] // ⭐ CORE WORKFLOW DATA
  }
  google_sheet_id?: string
  airtable_base_id?: string
  schedule?: ScheduleConfig // Cron settings
  webhooks?: WebhookConfig[]
}
```

#### **server/src/models/Run.ts** 🏃
```typescript
interface Run {
  id: UUID
  runId: UUID
  status: 'queued' | 'running' | 'success' | 'failed' | 'aborted'
  robotId: UUID
  robotMetaId: UUID
  browserId: UUID
  interpreterSettings: {
    maxConcurrency: number
    maxRepeats: number
    debug: boolean
  }
  serializableOutput: {
    scrapeSchema?: Record<string, any> // ⭐ EXTRACTED TEXT DATA
    scrapeList?: Record<string, any[]> // ⭐ EXTRACTED LIST DATA
  }
  binaryOutput: {
    [screenshotName: string]: string // Base64/MinIO URL
  }
  log: string // Execution logs
  retryCount: number
}
```

---

### **6. Frontend Components**

#### **src/pages/RecordingPage.tsx** 📹
```typescript
// MAIN UI FOR WORKFLOW RECORDING

Components:
- BrowserWindow: iframe showing remote browser
- LeftSidePanel: Workflow editor (WhereWhatPair list)
- RightSidePanel: Action settings
- BrowserNavBar: URL input & navigation controls

Context:
- BrowserStepsContext: Manages workflow state
- SocketContext: Real-time communication
- ActionContext: User interaction handlers
```

#### **src/components/recorder/Canvas.tsx** 🎨
```typescript
// VISUAL WORKFLOW BUILDER

Features:
- Drag-drop WhereWhatPair cards
- Inline editing of conditions & actions
- Breakpoint toggling
- Pair deletion & reordering
```

---

## 🎯 Entry Points for Web Chat Automation

### **Target Flow**
```
User Request → Maxun API → Create Robot → Execute Run → Extract Response
     ↓
Login to Chat Site → Send Message → Wait for Response → Extract Text
     ↓
Convert to OpenAI Format → Return JSON
```

---

## 🔄 Implementation: Web → OpenAI API Flow

### **Phase 1: Create Chat Workflow Template**

#### **Step 1: Record Once (Manual)**
For each chat provider (k2think, qwen, deepseek, grok, z.ai, mistral):

```typescript
// Create a template robot that:
1. Navigate to https://www.k2think.ai/
2. Click login button
3. Type email: developer@pixelium.uk
4. Type password: developer123?
5. Click submit
6. Wait for chat interface
7. Find message input field
8. Type: "{{USER_MESSAGE}}" // Parameterized
9. Click send button
10. Wait for response element
11. Scrape response text → scrapeSchema({ response: "selector" })
12. Store as Robot: "k2think-chat-template"
```

**Save as Robot Template:**
```json
{
  "recording_meta": {
    "name": "k2think-chat-template",
    "id": "uuid-123",
    "params": ["USER_MESSAGE"]
  },
  "recording": {
    "workflow": [
      { "where": { "url": "https://www.k2think.ai/" }, "what": [{ "action": "goto", "args": ["https://www.k2think.ai/"] }] },
      { "where": { "selectors": ["button:has-text('Login')"] }, "what": [{ "action": "click", "args": ["button:has-text('Login')"] }] },
      { "where": { "selectors": ["input[type='email']"] }, "what": [{ "action": "type", "args": ["input[type='email']", "developer@pixelium.uk"] }] },
      { "where": { "selectors": ["input[type='password']"] }, "what": [{ "action": "type", "args": ["input[type='password']", "{{ENCRYPTED_PASSWORD}}"] }] },
      { "where": { "selectors": ["button[type='submit']"] }, "what": [{ "action": "click", "args": ["button[type='submit']"] }] },
      { "where": { "selectors": [".chat-interface"] }, "what": [{ "action": "waitForSelector", "args": [".chat-interface"] }] },
      { "where": { "selectors": ["textarea.message-input"] }, "what": [{ "action": "type", "args": ["textarea.message-input", "{{USER_MESSAGE}}"] }] },
      { "where": { "selectors": ["button.send"] }, "what": [{ "action": "click", "args": ["button.send"] }] },
      { "where": { "selectors": [".response-text"] }, "what": [{ "action": "waitForSelector", "args": [".response-text", { "timeout": 30000 }] }] },
      { "where": { "selectors": [".response-text"] }, "what": [{ "action": "scrapeSchema", "args": [{ "response": ".response-text" }], "name": "chat-response" }] }
    ]
  }
}
```

---

### **Phase 2: Create OpenAI-Compatible API Wrapper**

#### **New Module: `server/src/api/llm-chat.ts`**
```typescript
import { Router, Request, Response } from 'express';
import { requireAPIKey } from '../middlewares/api';
import Robot from '../models/Robot';
import Run from '../models/Run';
import { handleRunRecording } from './record';

export const router = Router();

// OpenAI-compatible endpoint
router.post('/v1/chat/completions', requireAPIKey, async (req: Request, res: Response) => {
  try {
    const { model, messages, stream = false } = req.body;
    
    // 1. Map model to robot template
    const providerMap: Record<string, string> = {
      'k2think': 'k2think-chat-template-id',
      'qwen': 'qwen-chat-template-id',
      'deepseek': 'deepseek-chat-template-id',
      'grok': 'grok-chat-template-id',
      'z.ai': 'zai-chat-template-id',
      'mistral': 'mistral-chat-template-id',
    };
    
    const robotId = providerMap[model];
    if (!robotId) {
      return res.status(400).json({ error: `Model ${model} not supported` });
    }
    
    // 2. Extract user message
    const userMessage = messages[messages.length - 1]?.content || '';
    
    // 3. Execute robot with parameterized message
    const robot = await Robot.findByPk(robotId);
    if (!robot) {
      return res.status(404).json({ error: 'Robot template not found' });
    }
    
    // 4. Inject parameter into workflow
    const parameterizedWorkflow = injectParameter(
      robot.recording,
      'USER_MESSAGE',
      userMessage
    );
    
    // 5. Execute run
    const runId = await handleRunRecording(robotId, req.user.id);
    
    // 6. Wait for completion (or stream)
    if (stream) {
      return streamResponse(res, runId);
    } else {
      const run = await waitForRunCompletion(runId);
      
      // 7. Convert to OpenAI format
      const openAIResponse = convertToOpenAIFormat(run);
      return res.json(openAIResponse);
    }
    
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Helper: Inject parameter into workflow
function injectParameter(workflow: any, paramName: string, value: string) {
  const copy = JSON.parse(JSON.stringify(workflow));
  copy.workflow.forEach((pair: any) => {
    pair.what.forEach((action: any) => {
      if (Array.isArray(action.args)) {
        action.args = action.args.map((arg: any) =>
          typeof arg === 'string' && arg.includes(`{{${paramName}}}`)
            ? arg.replace(`{{${paramName}}}`, value)
            : arg
        );
      }
    });
  });
  return copy;
}

// Helper: Convert Run output to OpenAI format
function convertToOpenAIFormat(run: Run) {
  const extractedText = run.serializableOutput?.scrapeSchema?.['chat-response']?.response || '';
  
  return {
    id: `chatcmpl-${run.runId}`,
    object: 'chat.completion',
    created: Math.floor(new Date(run.startedAt).getTime() / 1000),
    model: run.robotMetaId,
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
      prompt_tokens: 0, // Estimate if needed
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}

// Helper: Stream response in real-time
async function streamResponse(res: Response, runId: string) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Poll run status and stream chunks
  const pollInterval = setInterval(async () => {
    const run = await Run.findOne({ where: { runId } });
    
    if (run?.status === 'success') {
      clearInterval(pollInterval);
      const text = run.serializableOutput?.scrapeSchema?.['chat-response']?.response || '';
      
      // Send final chunk
      res.write(`data: ${JSON.stringify({
        id: `chatcmpl-${runId}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: run.robotMetaId,
        choices: [{ index: 0, delta: { content: text }, finish_reason: 'stop' }],
      })}\n\n`);
      
      res.write('data: [DONE]\n\n');
      res.end();
    } else if (run?.status === 'failed') {
      clearInterval(pollInterval);
      res.write(`data: ${JSON.stringify({ error: 'Run failed' })}\n\n`);
      res.end();
    }
  }, 500);
}

export default router;
```

---

### **Phase 3: Register New Routes**

#### **Update `server/src/server.ts`**
```typescript
import llmChat from './api/llm-chat';

// ... existing routes
app.use('/api', llmChat); // Adds /api/v1/chat/completions
```

---

### **Phase 4: Test Flow**

#### **Example Request**
```bash
curl -X POST http://localhost:8080/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "model": "k2think",
    "messages": [
      {"role": "user", "content": "how are you"}
    ]
  }'
```

#### **Example Response**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "k2think-chat-template-id",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "I'm doing well, thank you for asking! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

---

## 🎬 Live Debugging & Recording Flow

### **Enhanced Recorder with Real-Time Debugging**

#### **New Feature: `server/src/api/record-debug.ts`**
```typescript
router.post('/record/chat-debug', requireSignIn, async (req: AuthenticatedRequest, res: Response) => {
  const { url, credentials, targetMessage } = req.body;
  
  // 1. Start recording browser
  const browserId = initializeRemoteBrowserForRecording(req.user.id, 'dom');
  
  // 2. Open URL
  const browser = browserPool.getRemoteBrowser(browserId);
  await browser?.getCurrentPage().goto(url);
  
  // 3. AI-powered element detection
  const chatElements = await detectChatElements(browser?.getCurrentPage());
  
  // 4. Send to frontend for confirmation
  res.json({
    browserId,
    detectedElements: {
      loginButton: chatElements.loginButton,
      emailInput: chatElements.emailInput,
      passwordInput: chatElements.passwordInput,
      messageInput: chatElements.messageInput,
      sendButton: chatElements.sendButton,
      responseContainer: chatElements.responseContainer,
    },
  });
});

// AI-powered element detection using LLM + DOM analysis
async function detectChatElements(page: Page) {
  const snapshot = await page.evaluate(() => {
    return {
      buttons: Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent?.trim(),
        selector: generateSelector(b),
      })),
      inputs: Array.from(document.querySelectorAll('input, textarea')).map(i => ({
        type: i.getAttribute('type'),
        placeholder: i.getAttribute('placeholder'),
        selector: generateSelector(i),
      })),
    };
  });
  
  // Use LLM to identify elements
  const prompt = `Analyze this page structure and identify chat interface elements:
  Buttons: ${JSON.stringify(snapshot.buttons)}
  Inputs: ${JSON.stringify(snapshot.inputs)}
  
  Return JSON with selectors for:
  - loginButton
  - emailInput
  - passwordInput
  - messageInput
  - sendButton
  - responseContainer`;
  
  // Call LLM (k2think/qwen/deepseek) to identify
  const llmResponse = await callLLM(prompt);
  return JSON.parse(llmResponse);
}
```

---

## 📊 Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│ 1. User sends OpenAI-compatible request            │
│    POST /api/v1/chat/completions                   │
│    { model: "k2think", messages: [...] }           │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│ 2. API maps model → Robot template                 │
│    "k2think" → k2think-chat-template-id             │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│ 3. Inject user message into workflow params        │
│    {{USER_MESSAGE}} → "how are you"                 │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│ 4. Create Run & queue execution                    │
│    handleRunRecording(robotId, userId)              │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│ 5. PgBoss worker picks up job                      │
│    processRunExecution({ runId, browserId })        │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│ 6. Get browser from pool                           │
│    browserPool.getRemoteBrowser(browserId)          │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│ 7. Execute workflow with Playwright                │
│    - Navigate to https://www.k2think.ai/           │
│    - Login with credentials                         │
│    - Type message in chat input                     │
│    - Click send                                     │
│    - Wait for response element                      │
│    - Scrape response text                           │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│ 8. Save extracted data to Run                      │
│    serializableOutput: {                            │
│      scrapeSchema: {                                │
│        'chat-response': { response: "I'm well!" }   │
│      }                                              │
│    }                                                │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│ 9. Convert to OpenAI format                        │
│    {                                                │
│      id: "chatcmpl-abc",                            │
│      choices: [{                                    │
│        message: { role: "assistant",                │
│                   content: "I'm well!" }            │
│      }]                                             │
│    }                                                │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│ 10. Return response to user                        │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Next Steps: Implementation Order

1. **Record Chat Templates** (Manual, 30 min each provider)
   - Use Maxun UI to record login + chat flow for each site
   - Save as parameterized Robot templates

2. **Build OpenAI Wrapper** (`server/src/api/llm-chat.ts`)
   - Implement POST /v1/chat/completions
   - Add model→robot mapping
   - Implement parameter injection
   - Add response conversion

3. **Add Live Debugging** (Optional but recommended)
   - AI-powered element detection
   - Real-time workflow validation
   - Selector regeneration on failure

4. **Testing & Iteration**
   - Test each provider individually
   - Handle edge cases (rate limits, CAPTCHAs)
   - Add retry logic

---

## 🎯 Key Files to Modify

```
server/src/api/llm-chat.ts         ← NEW: OpenAI-compatible endpoint
server/src/server.ts                ← Register new route
server/src/models/Robot.ts          ← Maybe add chatProvider field
ENVEXAMPLE                          ← Add credentials for each provider
```

Would you like me to start implementing this now?

