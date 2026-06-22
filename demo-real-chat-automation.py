#!/usr/bin/env python3
"""
Real Browser Automation Demo for Chat Interfaces
Using Maxun API-based procedural browser automation

This script demonstrates:
1. Creating browser automation recordings
2. Using real credentials to login
3. Sending messages through web chat interfaces
4. Retrieving messages from chat platforms
5. Using Maxun's recording-based approach
"""

import json
import time
import requests
from typing import Dict, List, Optional

class MaxunChatAutomation:
    """
    Maxun API client for browser-based chat automation
    """
    
    def __init__(self, base_url: str = "http://localhost:8080", api_key: Optional[str] = None):
        self.base_url = base_url
        self.api_key = api_key
        self.session = requests.Session()
        if api_key:
            self.session.headers.update({"X-API-Key": api_key})
    
    def create_recording(self, name: str, url: str, steps: List[Dict]) -> Dict:
        """
        Create a new browser automation recording
        
        Args:
            name: Name of the recording
            url: Starting URL
            steps: List of automation steps
        
        Returns:
            Recording metadata
        """
        payload = {
            "name": name,
            "url": url,
            "steps": steps,
            "created_at": time.time()
        }
        
        response = self.session.post(
            f"{self.base_url}/api/recordings",
            json=payload
        )
        
        if response.status_code == 201:
            return response.json()
        else:
            raise Exception(f"Failed to create recording: {response.text}")
    
    def execute_recording(self, recording_id: str, parameters: Dict) -> Dict:
        """
        Execute a browser automation recording with parameters
        
        Args:
            recording_id: ID of the recording to execute
            parameters: Dynamic parameters (credentials, message text, etc.)
        
        Returns:
            Execution result
        """
        payload = {
            "recording_id": recording_id,
            "parameters": parameters,
            "headless": False,  # Show browser for demo
            "screenshot": True,
            "timeout": 60000
        }
        
        response = self.session.post(
            f"{self.base_url}/api/executions",
            json=payload
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to execute recording: {response.text}")
    
    def get_execution_status(self, execution_id: str) -> Dict:
        """
        Get the status of a running execution
        """
        response = self.session.get(
            f"{self.base_url}/api/executions/{execution_id}"
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to get execution status: {response.text}")

# ============================================================================
# Example 1: Generic Web Chat Message Sender
# ============================================================================

def create_chat_sender_recording(client: MaxunChatAutomation) -> str:
    """
    Create a recording for sending messages to web chat interfaces
    """
    
    steps = [
        # Step 1: Navigate to chat URL
        {
            "type": "navigate",
            "url": "{{chat_url}}",
            "wait_for": "networkidle"
        },
        
        # Step 2: Login (if required)
        {
            "type": "conditional",
            "condition": "element_exists",
            "selector": "input[type='email'], input[name='username']",
            "then": [
                {
                    "type": "type",
                    "selector": "input[type='email'], input[name='username']",
                    "text": "{{username}}"
                },
                {
                    "type": "type",
                    "selector": "input[type='password'], input[name='password']",
                    "text": "{{password}}"
                },
                {
                    "type": "click",
                    "selector": "button[type='submit'], button:has-text('Login'), button:has-text('Sign in')"
                },
                {
                    "type": "wait",
                    "duration": 3000
                }
            ]
        },
        
        # Step 3: Find message input field
        {
            "type": "wait_for",
            "selector": "textarea, input[type='text'], div[contenteditable='true']",
            "timeout": 10000
        },
        
        # Step 4: Type message
        {
            "type": "type",
            "selector": "textarea, input[type='text'], div[contenteditable='true']",
            "text": "{{message}}"
        },
        
        # Step 5: Send message
        {
            "type": "click",
            "selector": "button:has-text('Send'), button[aria-label*='Send'], button[type='submit']"
        },
        
        # Step 6: Wait for confirmation
        {
            "type": "wait",
            "duration": 2000
        },
        
        # Step 7: Capture screenshot
        {
            "type": "screenshot",
            "name": "message_sent"
        }
    ]
    
    recording = client.create_recording(
        name="Generic Chat Message Sender",
        url="{{chat_url}}",
        steps=steps
    )
    
    return recording["id"]

# ============================================================================
# Example 2: Chat Message Retriever
# ============================================================================

def create_chat_retriever_recording(client: MaxunChatAutomation) -> str:
    """
    Create a recording for retrieving messages from chat interfaces
    """
    
    steps = [
        # Step 1: Navigate and login (similar to sender)
        {
            "type": "navigate",
            "url": "{{chat_url}}"
        },
        
        # Step 2: Login if needed
        {
            "type": "conditional",
            "condition": "element_exists",
            "selector": "input[type='email'], input[name='username']",
            "then": [
                {
                    "type": "type",
                    "selector": "input[type='email'], input[name='username']",
                    "text": "{{username}}"
                },
                {
                    "type": "type",
                    "selector": "input[type='password']",
                    "text": "{{password}}"
                },
                {
                    "type": "click",
                    "selector": "button[type='submit']"
                },
                {
                    "type": "wait",
                    "duration": 3000
                }
            ]
        },
        
        # Step 3: Scroll to load messages
        {
            "type": "scroll",
            "direction": "up",
            "amount": 500
        },
        
        # Step 4: Wait for messages to load
        {
            "type": "wait",
            "duration": 2000
        },
        
        # Step 5: Extract messages
        {
            "type": "extract",
            "name": "messages",
            "selector": ".message, [data-message-id], div[role='listitem']",
            "fields": {
                "text": {"selector": ".message-text, .text-content", "attribute": "textContent"},
                "author": {"selector": ".author, .sender", "attribute": "textContent"},
                "timestamp": {"selector": ".timestamp, time", "attribute": "textContent"},
                "id": {"selector": "", "attribute": "data-message-id"}
            }
        },
        
        # Step 6: Screenshot for verification
        {
            "type": "screenshot",
            "name": "messages_retrieved"
        }
    ]
    
    recording = client.create_recording(
        name="Generic Chat Message Retriever",
        url="{{chat_url}}",
        steps=steps
    )
    
    return recording["id"]

# ============================================================================
# Example 3: Demo Test Chat Platform
# ============================================================================

def demo_with_test_platform():
    """
    Demonstrate automation using a test chat platform
    """
    
    print("\n" + "="*80)
    print("  MAXUN BROWSER AUTOMATION DEMO - Real Chat Interface")
    print("="*80 + "\n")
    
    # Initialize client
    client = MaxunChatAutomation(base_url="http://localhost:8080")
    
    # Create recordings
    print("📝 Creating automation recordings...")
    
    try:
        sender_id = create_chat_sender_recording(client)
        print(f"✓ Created message sender recording: {sender_id}")
        
        retriever_id = create_chat_retriever_recording(client)
        print(f"✓ Created message retriever recording: {retriever_id}")
    except Exception as e:
        print(f"⚠️  Note: {e}")
        print("   This is expected if Maxun backend is not running.")
        print("   The code demonstrates the API structure.")
        return
    
    # Example execution parameters
    test_params = {
        "chat_url": "https://demo-chat.example.com",  # Replace with actual URL
        "username": "test_user@example.com",
        "password": "test_password_123",
        "message": "Hello! This is an automated test message from Maxun."
    }
    
    print("\n📤 Executing message sender automation...")
    print(f"   Platform: {test_params['chat_url']}")
    print(f"   User: {test_params['username']}")
    print(f"   Message: '{test_params['message']}'")
    
    try:
        execution = client.execute_recording(sender_id, test_params)
        execution_id = execution["execution_id"]
        
        print(f"✓ Execution started: {execution_id}")
        print("   Watching browser automation in progress...")
        
        # Poll for completion
        while True:
            status = client.get_execution_status(execution_id)
            
            if status["status"] == "completed":
                print(f"\n✅ Message sent successfully!")
                print(f"   Execution time: {status['duration_ms']}ms")
                print(f"   Screenshots: {len(status.get('screenshots', []))}")
                break
            elif status["status"] == "failed":
                print(f"\n❌ Execution failed: {status.get('error')}")
                break
            
            time.sleep(2)
        
        # Now retrieve messages
        print("\n📥 Executing message retriever automation...")
        
        retrieval = client.execute_recording(retriever_id, test_params)
        retrieval_id = retrieval["execution_id"]
        
        while True:
            status = client.get_execution_status(retrieval_id)
            
            if status["status"] == "completed":
                messages = status.get("extracted_data", {}).get("messages", [])
                print(f"\n✅ Retrieved {len(messages)} messages!")
                
                for i, msg in enumerate(messages[:5], 1):
                    print(f"\n   Message {i}:")
                    print(f"   Author: {msg.get('author', 'Unknown')}")
                    print(f"   Text: {msg.get('text', '')[:100]}...")
                    print(f"   Time: {msg.get('timestamp', 'N/A')}")
                
                break
            elif status["status"] == "failed":
                print(f"\n❌ Retrieval failed: {status.get('error')}")
                break
            
            time.sleep(2)
        
    except Exception as e:
        print(f"⚠️  Execution error: {e}")
    
    print("\n" + "="*80)
    print("  Demo completed!")
    print("="*80 + "\n")

# ============================================================================
# Practical Implementation Guide
# ============================================================================

def show_implementation_guide():
    """
    Show practical examples of how to use this with real platforms
    """
    
    print("\n" + "="*80)
    print("  IMPLEMENTATION GUIDE - Real Platform Examples")
    print("="*80 + "\n")
    
    print("🔧 SETUP INSTRUCTIONS:")
    print("""
    1. Start Maxun backend:
       cd maxun
       docker-compose up -d
       
    2. Access Maxun UI:
       Open http://localhost:5173
       
    3. Create a recording manually:
       - Click "New Recording"
       - Navigate to your chat platform
       - Perform actions (login, send message)
       - Save the recording
       
    4. Get the recording ID from the UI
       
    5. Use this script to execute recordings programmatically
    """)
    
    print("\n📋 EXAMPLE PLATFORMS YOU CAN AUTOMATE:")
    print("""
    ✓ Discord Web (discord.com/app)
    ✓ Slack Web (slack.com)
    ✓ Microsoft Teams (teams.microsoft.com)
    ✓ WhatsApp Web (web.whatsapp.com)
    ✓ Telegram Web (web.telegram.org)
    ✓ Custom chat applications
    ✓ Internal messaging platforms
    """)
    
    print("\n🔐 CREDENTIALS HANDLING:")
    print("""
    Option 1: Environment Variables
    export CHAT_USERNAME="your_email@example.com"
    export CHAT_PASSWORD="your_password"
    
    Option 2: Secure Vault (recommended)
    Store credentials in HashiCorp Vault, AWS Secrets Manager, etc.
    
    Option 3: Encrypted Config File
    Use encrypted JSON/YAML with credentials
    """)
    
    print("\n💡 EXAMPLE: Send Message to Discord")
    print("""
    from demo_real_chat_automation import MaxunChatAutomation
    
    client = MaxunChatAutomation("http://localhost:8080")
    
    # Use a pre-created Discord recording
    discord_recording_id = "rec-discord-sender-123"
    
    result = client.execute_recording(
        recording_id=discord_recording_id,
        parameters={
            "chat_url": "https://discord.com/channels/12345/67890",
            "username": "your_email@example.com",
            "password": "your_password",
            "message": "Hello from Maxun automation!"
        }
    )
    
    print(f"Message sent! Execution ID: {result['execution_id']}")
    """)
    
    print("\n💡 EXAMPLE: Retrieve Messages from Slack")
    print("""
    # Use a pre-created Slack retrieval recording
    slack_recording_id = "rec-slack-retriever-456"
    
    result = client.execute_recording(
        recording_id=slack_recording_id,
        parameters={
            "chat_url": "https://app.slack.com/client/T12345/C67890",
            "username": "your_email@example.com",
            "password": "your_password"
        }
    )
    
    # Get extracted messages
    status = client.get_execution_status(result['execution_id'])
    messages = status['extracted_data']['messages']
    
    for msg in messages:
        print(f"{msg['author']}: {msg['text']}")
    """)
    
    print("\n" + "="*80 + "\n")

# ============================================================================
# Main Execution
# ============================================================================

if __name__ == "__main__":
    print("""
    ╔══════════════════════════════════════════════════════════════════════╗
    ║                                                                      ║
    ║      MAXUN BROWSER AUTOMATION - Real Chat Interface Demo            ║
    ║                                                                      ║
    ║  This script demonstrates API-based procedural browser automation   ║
    ║  for web chat interfaces using recordings, credentials, and         ║
    ║  parameterized execution.                                           ║
    ║                                                                      ║
    ╚══════════════════════════════════════════════════════════════════════╝
    """)
    
    print("\n🎯 Choose a demo option:\n")
    print("1. Show implementation guide")
    print("2. Run test platform demo")
    print("3. Show API examples")
    
    choice = input("\nEnter choice (1-3): ").strip()
    
    if choice == "1":
        show_implementation_guide()
    elif choice == "2":
        demo_with_test_platform()
    elif choice == "3":
        show_implementation_guide()
        demo_with_test_platform()
    else:
        print("Invalid choice. Showing implementation guide...")
        show_implementation_guide()
    
    print("\n📚 For more information:")
    print("   - Maxun Documentation: https://github.com/getmaxun/maxun")
    print("   - API Reference: http://localhost:8080/api/docs")
    print("   - Configuration Files: config/streaming-providers/")
    print()

