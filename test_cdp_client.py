#!/usr/bin/env python3
"""
Test Client for CDP WebSocket Server
Tests all 6 endpoints with actual credentials from YAML config
"""

import asyncio
import websockets
import json
import yaml
from pathlib import Path
from typing import Dict, List
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CDPTestClient:
    """Test client for CDP WebSocket server"""
    
    def __init__(self, ws_url: str = "ws://localhost:8765", credentials_file: str = "config/platforms/credentials.yaml"):
        self.ws_url = ws_url
        self.credentials_file = Path(credentials_file)
        self.credentials = None
        self.load_credentials()
    
    def load_credentials(self):
        """Load credentials from YAML file"""
        if self.credentials_file.exists():
            with open(self.credentials_file) as f:
                self.credentials = yaml.safe_load(f)
            logger.info("Loaded credentials from file")
        else:
            logger.warning(f"Credentials file not found: {self.credentials_file}")
            self.credentials = {"platforms": {}}
    
    async def send_openai_request(self, platform: str, message: str, recipient: str = None) -> Dict:
        """Send OpenAI-formatted request to CDP server"""
        
        creds = self.credentials["platforms"].get(platform, {})
        
        request = {
            "model": f"maxun-robot-{platform}",
            "messages": [
                {"role": "system", "content": f"Platform: {platform}"},
                {"role": "user", "content": message}
            ],
            "stream": False,
            "metadata": {
                "username": creds.get("username"),
                "password": creds.get("password"),
                "recipient": recipient,
                "server_id": creds.get("server_id"),
                "channel_id": creds.get("channel_id"),
                "workspace_id": creds.get("workspace_id"),
                "team_id": creds.get("team_id")
            }
        }
        
        async with websockets.connect(self.ws_url) as websocket:
            # Send request
            await websocket.send(json.dumps(request))
            
            # Receive response
            response = await websocket.recv()
            return json.loads(response)
    
    async def test_discord(self):
        """Test Discord message sending"""
        logger.info("=" * 80)
        logger.info("TEST 1: Discord Message Sender")
        logger.info("=" * 80)
        
        try:
            response = await self.send_openai_request(
                platform="discord",
                message="Hello from CDP WebSocket automation!",
                recipient="#general"
            )
            
            logger.info(f"✅ SUCCESS")
            logger.info(f"Response: {json.dumps(response, indent=2)}")
            return True
            
        except Exception as e:
            logger.error(f"❌ FAILED: {e}")
            return False
    
    async def test_slack(self):
        """Test Slack message sending"""
        logger.info("\n" + "=" * 80)
        logger.info("TEST 2: Slack Message Sender")
        logger.info("=" * 80)
        
        try:
            response = await self.send_openai_request(
                platform="slack",
                message="Automated message from CDP server",
                recipient="#general"
            )
            
            logger.info(f"✅ SUCCESS")
            logger.info(f"Response: {json.dumps(response, indent=2)}")
            return True
            
        except Exception as e:
            logger.error(f"❌ FAILED: {e}")
            return False
    
    async def test_teams(self):
        """Test Microsoft Teams message sending"""
        logger.info("\n" + "=" * 80)
        logger.info("TEST 3: Microsoft Teams Message Sender")
        logger.info("=" * 80)
        
        try:
            response = await self.send_openai_request(
                platform="teams",
                message="Teams automation test",
                recipient="General"
            )
            
            logger.info(f"✅ SUCCESS")
            logger.info(f"Response: {json.dumps(response, indent=2)}")
            return True
            
        except Exception as e:
            logger.error(f"❌ FAILED: {e}")
            return False
    
    async def test_whatsapp(self):
        """Test WhatsApp Web message sending"""
        logger.info("\n" + "=" * 80)
        logger.info("TEST 4: WhatsApp Web Message Sender")
        logger.info("=" * 80)
        
        try:
            response = await self.send_openai_request(
                platform="whatsapp",
                message="WhatsApp automation test",
                recipient="John Doe"
            )
            
            logger.info(f"✅ SUCCESS")
            logger.info(f"Response: {json.dumps(response, indent=2)}")
            return True
            
        except Exception as e:
            logger.error(f"❌ FAILED: {e}")
            return False
    
    async def test_telegram(self):
        """Test Telegram Web message sending"""
        logger.info("\n" + "=" * 80)
        logger.info("TEST 5: Telegram Web Message Sender")
        logger.info("=" * 80)
        
        try:
            response = await self.send_openai_request(
                platform="telegram",
                message="Telegram automation test",
                recipient="John Smith"
            )
            
            logger.info(f"✅ SUCCESS")
            logger.info(f"Response: {json.dumps(response, indent=2)}")
            return True
            
        except Exception as e:
            logger.error(f"❌ FAILED: {e}")
            return False
    
    async def test_custom(self):
        """Test custom platform message sending"""
        logger.info("\n" + "=" * 80)
        logger.info("TEST 6: Custom Platform Message Sender")
        logger.info("=" * 80)
        
        try:
            response = await self.send_openai_request(
                platform="custom",
                message="Custom platform automation test"
            )
            
            logger.info(f"✅ SUCCESS")
            logger.info(f"Response: {json.dumps(response, indent=2)}")
            return True
            
        except Exception as e:
            logger.error(f"❌ FAILED: {e}")
            return False
    
    async def run_all_tests(self):
        """Run all platform tests"""
        logger.info("\n" + "█" * 80)
        logger.info("█  CDP WEBSOCKET SERVER - ALL ENDPOINTS TEST")
        logger.info("█  Testing with ACTUAL CREDENTIALS from credentials.yaml")
        logger.info("█" * 80 + "\n")
        
        results = {
            "discord": await self.test_discord(),
            "slack": await self.test_slack(),
            "teams": await self.test_teams(),
            "whatsapp": await self.test_whatsapp(),
            "telegram": await self.test_telegram(),
            "custom": await self.test_custom()
        }
        
        # Summary
        logger.info("\n" + "=" * 80)
        logger.info("TEST SUMMARY")
        logger.info("=" * 80)
        
        passed = sum(1 for r in results.values() if r)
        total = len(results)
        
        for platform, success in results.items():
            status = "✅ PASS" if success else "❌ FAIL"
            logger.info(f"{platform.capitalize():15s} {status}")
        
        logger.info("=" * 80)
        logger.info(f"TOTAL: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
        logger.info("=" * 80 + "\n")
        
        return results

async def main():
    """Main test entry point"""
    
    # Check if credentials file exists
    creds_file = Path("config/platforms/credentials.yaml")
    
    if not creds_file.exists():
        logger.error("❌ Credentials file not found!")
        logger.info("📝 Please create config/platforms/credentials.yaml with your actual credentials")
        logger.info("   Template provided in credentials.yaml")
        return
    
    # Create test client
    client = CDPTestClient()
    
    # Check if credentials are filled in
    if "your_discord_email" in str(client.credentials):
        logger.warning("⚠️  Credentials appear to be template values!")
        logger.info("   Please fill in config/platforms/credentials.yaml with your ACTUAL credentials")
        logger.info("   Then run this test again")
        return
    
    # Run tests
    try:
        await client.run_all_tests()
    except Exception as e:
        logger.error(f"Test suite failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())

