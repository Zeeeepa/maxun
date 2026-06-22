# Maxun Chat Automation Examples

Quick start guide for automating web-based chat interfaces using Maxun API.

## Setup

1. Deploy Maxun: `cd .. && ./deploy_chat_automation.sh`
2. Get API key from http://localhost:5173
3. Create a robot by recording your workflow
4. Set environment variables or create .env file

## Python Example

```bash
pip install requests python-dotenv
export MAXUN_API_KEY="your-key"
export MAXUN_ROBOT_ID="your-robot-id"
python chat_automation_python.py
```

## Node.js Example

```bash
npm install axios dotenv
export MAXUN_API_KEY="your-key"
export MAXUN_ROBOT_ID="your-robot-id"
node chat_automation_node.js
```

## Bash Example

```bash
export MAXUN_API_KEY="your-key"
export MAXUN_ROBOT_ID="your-robot-id"
./chat_automation_bash.sh
```

See [Full Documentation](../docs/BROWSER_AUTOMATION_CHAT.md) for detailed examples.
