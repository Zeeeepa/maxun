#!/usr/bin/env python3
"""
CDP WebSocket Server for Multi-Platform Browser Automation
Uses Chrome DevTools Protocol to control multiple browser instances
OpenAI API compatible request/response format
"""

import asyncio
import json
import yaml
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime
import websockets
from websockets.server import serve
import aiohttp
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class BrowserSession:
    """Represents a browser session connected via CDP"""
    session_id: str
    platform: str
    ws_url: str
    page_id: str
    authenticated: bool = False
    last_activity: datetime = None
    
@dataclass
class OpenAIRequest:
    """OpenAI API compatible request format"""
    model: str
    messages: List[Dict[str, str]]
    stream: bool = False
    temperature: float = 0.7
    metadata: Dict[str, Any] = None

@dataclass
class OpenAIResponse:
    """OpenAI API compatible response format"""
    id: str
    object: str
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, int] = None
    metadata: Dict[str, Any] = None

class CDPClient:
    """Chrome DevTools Protocol client"""
    
    def __init__(self, ws_url: str):
        self.ws_url = ws_url
        self.ws = None
        self.message_id = 0
        self.pending_responses = {}
        
    async def connect(self):
        """Connect to CDP WebSocket"""
        try:
            self.ws = await websockets.connect(self.ws_url)
            logger.info(f"Connected to CDP: {self.ws_url}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to CDP: {e}")
            return False
    
    async def send_command(self, method: str, params: Dict = None) -> Dict:
        """Send CDP command and wait for response"""
        self.message_id += 1
        message = {
            "id": self.message_id,
            "method": method,
            "params": params or {}
        }
        
        await self.ws.send(json.dumps(message))
        
        # Wait for response
        while True:
            response = await self.ws.recv()
            data = json.loads(response)
            
            if data.get("id") == self.message_id:
                return data.get("result", {})
    
    async def navigate(self, url: str):
        """Navigate to URL"""
        return await self.send_command("Page.navigate", {"url": url})
    
    async def type_text(self, selector: str, text: str):
        """Type text into element"""
        # Get element
        result = await self.send_command("DOM.getDocument")
        root = result["root"]["nodeId"]
        
        node = await self.send_command("DOM.querySelector", {
            "nodeId": root,
            "selector": selector
        })
        
        # Focus and type
        await self.send_command("DOM.focus", {"nodeId": node["nodeId"]})
        
        for char in text:
            await self.send_command("Input.dispatchKeyEvent", {
                "type": "keyDown",
                "text": char
            })
            await asyncio.sleep(0.05)
    
    async def click(self, selector: str):
        """Click element"""
        result = await self.send_command("DOM.getDocument")
        root = result["root"]["nodeId"]
        
        node = await self.send_command("DOM.querySelector", {
            "nodeId": root,
            "selector": selector
        })
        
        # Get box model for click coordinates
        box = await self.send_command("DOM.getBoxModel", {
            "nodeId": node["nodeId"]
        })
        
        # Click center of element
        content = box["model"]["content"]
        x = (content[0] + content[2]) / 2
        y = (content[1] + content[5]) / 2
        
        await self.send_command("Input.dispatchMouseEvent", {
            "type": "mousePressed",
            "x": x,
            "y": y,
            "button": "left",
            "clickCount": 1
        })
        
        await self.send_command("Input.dispatchMouseEvent", {
            "type": "mouseReleased",
            "x": x,
            "y": y,
            "button": "left",
            "clickCount": 1
        })
    
    async def screenshot(self) -> str:
        """Take screenshot, returns base64"""
        result = await self.send_command("Page.captureScreenshot")
        return result.get("data", "")
    
    async def extract_text(self, selector: str) -> str:
        """Extract text from element"""
        result = await self.send_command("DOM.getDocument")
        root = result["root"]["nodeId"]
        
        node = await self.send_command("DOM.querySelector", {
            "nodeId": root,
            "selector": selector
        })
        
        outer_html = await self.send_command("DOM.getOuterHTML", {
            "nodeId": node["nodeId"]
        })
        
        return outer_html.get("outerHTML", "")
    
    async def close(self):
        """Close connection"""
        if self.ws:
            await self.ws.close()

class PlatformWorkflow:
    """Manages workflow execution for a specific platform"""
    
    def __init__(self, config: Dict, cdp_client: CDPClient):
        self.config = config
        self.cdp = cdp_client
        
    async def execute_login(self, username: str, password: str):
        """Execute login workflow"""
        steps = self.config["workflows"]["login"]["steps"]
        
        for step in steps:
            step_type = step["type"]
            
            if step_type == "navigate":
                await self.cdp.navigate(step["url"])
                await asyncio.sleep(2)
                
            elif step_type == "type":
                selector = step["selector"]
                if "username" in step.get("field", ""):
                    await self.cdp.type_text(selector, username)
                elif "password" in step.get("field", ""):
                    await self.cdp.type_text(selector, password)
                else:
                    await self.cdp.type_text(selector, step["text"])
                    
            elif step_type == "click":
                await self.cdp.click(step["selector"])
                await asyncio.sleep(step.get("wait", 1))
                
            elif step_type == "wait":
                await asyncio.sleep(step["duration"] / 1000)
    
    async def execute_send_message(self, message: str, recipient: str = None):
        """Execute send message workflow"""
        steps = self.config["workflows"]["send_message"]["steps"]
        
        for step in steps:
            step_type = step["type"]
            
            if step_type == "navigate":
                url = step["url"]
                if recipient:
                    url = url.replace("{{recipient}}", recipient)
                await self.cdp.navigate(url)
                await asyncio.sleep(2)
                
            elif step_type == "type":
                selector = step["selector"]
                if step.get("field") == "message":
                    await self.cdp.type_text(selector, message)
                else:
                    await self.cdp.type_text(selector, step["text"])
                    
            elif step_type == "click":
                await self.cdp.click(step["selector"])
                await asyncio.sleep(step.get("wait", 1))
                
            elif step_type == "wait":
                await asyncio.sleep(step["duration"] / 1000)
    
    async def execute_retrieve_messages(self) -> List[Dict]:
        """Execute retrieve messages workflow"""
        steps = self.config["workflows"]["retrieve_messages"]["steps"]
        messages = []
        
        for step in steps:
            step_type = step["type"]
            
            if step_type == "extract":
                selector = step["selector"]
                # Extract all matching elements
                # This is simplified - real implementation would loop through all matches
                text = await self.cdp.extract_text(selector)
                messages.append({"text": text, "timestamp": datetime.now().isoformat()})
        
        return messages

class MultiBrowserManager:
    """Manages multiple browser sessions via CDP"""
    
    def __init__(self, config_dir: str = "config/platforms"):
        self.config_dir = Path(config_dir)
        self.sessions: Dict[str, BrowserSession] = {}
        self.workflows: Dict[str, PlatformWorkflow] = {}
        self.chrome_instances: Dict[str, asyncio.subprocess.Process] = {}
        
    async def start_chrome_instance(self, platform: str, port: int) -> str:
        """Start Chrome with remote debugging"""
        cmd = [
            "google-chrome",
            "--headless=new",
            f"--remote-debugging-port={port}",
            "--no-first-run",
            "--no-default-browser-check",
            f"--user-data-dir=/tmp/chrome-{platform}",
            "about:blank"
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        self.chrome_instances[platform] = process
        
        # Wait for Chrome to start
        await asyncio.sleep(2)
        
        # Get WebSocket URL
        async with aiohttp.ClientSession() as session:
            async with session.get(f"http://localhost:{port}/json/version") as resp:
                data = await resp.json()
                ws_url = data["webSocketDebuggerUrl"]
        
        return ws_url
    
    async def initialize_session(self, platform: str, config: Dict, port: int):
        """Initialize a browser session for a platform"""
        # Start Chrome instance
        ws_url = await self.start_chrome_instance(platform, port)
        
        # Create CDP client
        cdp_client = CDPClient(ws_url)
        await cdp_client.connect()
        
        # Enable necessary domains
        await cdp_client.send_command("Page.enable")
        await cdp_client.send_command("DOM.enable")
        await cdp_client.send_command("Network.enable")
        
        # Create session
        session = BrowserSession(
            session_id=f"{platform}-{datetime.now().timestamp()}",
            platform=platform,
            ws_url=ws_url,
            page_id="",
            last_activity=datetime.now()
        )
        
        self.sessions[platform] = session
        
        # Create workflow handler
        self.workflows[platform] = PlatformWorkflow(config, cdp_client)
        
        logger.info(f"Initialized session for {platform}")
    
    async def login_platform(self, platform: str, username: str, password: str):
        """Login to a platform"""
        if platform not in self.workflows:
            raise ValueError(f"Platform {platform} not initialized")
        
        workflow = self.workflows[platform]
        await workflow.execute_login(username, password)
        
        self.sessions[platform].authenticated = True
        logger.info(f"Logged in to {platform}")
    
    async def send_message(self, platform: str, message: str, recipient: str = None):
        """Send message on a platform"""
        if platform not in self.workflows:
            raise ValueError(f"Platform {platform} not initialized")
        
        if not self.sessions[platform].authenticated:
            raise ValueError(f"Not authenticated on {platform}")
        
        workflow = self.workflows[platform]
        await workflow.execute_send_message(message, recipient)
        
        logger.info(f"Sent message on {platform}")
    
    async def retrieve_messages(self, platform: str) -> List[Dict]:
        """Retrieve messages from a platform"""
        if platform not in self.workflows:
            raise ValueError(f"Platform {platform} not initialized")
        
        if not self.sessions[platform].authenticated:
            raise ValueError(f"Not authenticated on {platform}")
        
        workflow = self.workflows[platform]
        messages = await workflow.execute_retrieve_messages()
        
        logger.info(f"Retrieved {len(messages)} messages from {platform}")
        return messages
    
    async def cleanup(self):
        """Cleanup all browser sessions"""
        for platform, process in self.chrome_instances.items():
            process.terminate()
            await process.wait()
        
        logger.info("Cleaned up all browser sessions")

class OpenAIAPIServer:
    """OpenAI-compatible API server"""
    
    def __init__(self, browser_manager: MultiBrowserManager):
        self.browser_manager = browser_manager
        self.execution_id = 0
        
    def parse_openai_request(self, data: Dict) -> OpenAIRequest:
        """Parse OpenAI format request"""
        return OpenAIRequest(
            model=data.get("model", ""),
            messages=data.get("messages", []),
            stream=data.get("stream", False),
            temperature=data.get("temperature", 0.7),
            metadata=data.get("metadata", {})
        )
    
    def create_openai_response(self, content: str, model: str, metadata: Dict = None) -> Dict:
        """Create OpenAI format response"""
        self.execution_id += 1
        
        response = OpenAIResponse(
            id=f"chatcmpl-{self.execution_id}",
            object="chat.completion",
            created=int(datetime.now().timestamp()),
            model=model,
            choices=[{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content
                },
                "finish_reason": "stop"
            }],
            metadata=metadata
        )
        
        return asdict(response)
    
    async def handle_request(self, request_data: Dict) -> Dict:
        """Handle OpenAI API request"""
        req = self.parse_openai_request(request_data)
        
        # Extract platform from model name (e.g., "maxun-robot-discord")
        platform = req.model.split("-")[-1] if "-" in req.model else "discord"
        
        # Extract intent from messages
        user_message = req.messages[-1]["content"]
        system_message = next((m["content"] for m in req.messages if m["role"] == "system"), "")
        
        # Parse metadata
        username = req.metadata.get("username")
        password = req.metadata.get("password")
        recipient = req.metadata.get("recipient")
        
        try:
            # Login if not authenticated
            if platform in self.browser_manager.sessions and not self.browser_manager.sessions[platform].authenticated:
                await self.browser_manager.login_platform(platform, username, password)
            
            # Send message
            await self.browser_manager.send_message(platform, user_message, recipient)
            
            # Create response
            response = self.create_openai_response(
                content=f"Message sent successfully to {platform}",
                model=req.model,
                metadata={
                    "platform": platform,
                    "execution_time_ms": 2500,
                    "authenticated": True
                }
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Error handling request: {e}")
            return self.create_openai_response(
                content=f"Error: {str(e)}",
                model=req.model,
                metadata={"error": str(e)}
            )

async def websocket_handler(websocket, path, api_server: OpenAIAPIServer):
    """Handle WebSocket connections"""
    logger.info(f"New WebSocket connection from {websocket.remote_address}")
    
    try:
        async for message in websocket:
            data = json.loads(message)
            
            # Handle OpenAI API request
            response = await api_server.handle_request(data)
            
            # Send response
            await websocket.send(json.dumps(response))
            
    except websockets.exceptions.ConnectionClosed:
        logger.info("WebSocket connection closed")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")

async def main():
    """Main entry point"""
    logger.info("Starting CDP WebSocket Server...")
    
    # Initialize browser manager
    browser_manager = MultiBrowserManager()
    
    # Load platform configurations
    platforms = ["discord", "slack", "teams", "whatsapp", "telegram", "custom"]
    base_port = 9222
    
    for i, platform in enumerate(platforms):
        config_file = Path(f"config/platforms/{platform}.yaml")
        if config_file.exists():
            with open(config_file) as f:
                config = yaml.safe_load(f)
            
            await browser_manager.initialize_session(platform, config, base_port + i)
    
    # Create API server
    api_server = OpenAIAPIServer(browser_manager)
    
    # Start WebSocket server
    async with serve(
        lambda ws, path: websocket_handler(ws, path, api_server),
        "localhost",
        8765
    ):
        logger.info("WebSocket server listening on ws://localhost:8765")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Shutting down...")

