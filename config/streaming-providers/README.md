# Streaming Provider with OpenAI API Compatibility

Complete streaming provider system for Maxun with:
- ✅ OpenAI API Compatibility 
- ✅ Vision-Based Error Resolution (6 strategies)
- ✅ 6 Programmatic Entry Points
- ✅ Auto-Scaling (2-20 instances)
- ✅ Real-Time Streaming (SSE)

## 📦 The 6 Configuration Files

### File 1: `01-provider-config.yaml`
Core provider infrastructure and settings.

### File 2: `02-robot-workflows.json`
Preconfigured automation workflows with vision fallback.

### File 3: `03-openai-adapter.yaml`
OpenAI API compatibility layer.

### File 4: `04-vision-resolution.json`
AI vision-based error resolution engine with 6 strategies.

### File 5: `05-entry-points.yaml`
6 programmatic API entry points.

### File 6: `06-scalability-deployment.yaml`
Production deployment and auto-scaling configuration.

## 🚀 Quick Start

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_MAXUN_API_KEY",
    base_url="http://localhost:8080/v1"
)

response = client.chat.completions.create(
    model="maxun-robot-chat-sender",
    messages=[
        {"role": "system", "content": "url: https://chat.example.com"},
        {"role": "user", "content": "Hello!"}
    ],
    metadata={"username": "user@example.com", "password": "password"},
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content, end="")
```

## 🔄 Vision-Based Resolution (6 Strategies)

1. **Selector Refinement**: Vision-guided CSS selector discovery
2. **Wait and Retry**: Intelligent waiting with vision verification
3. **Alternative Selectors**: XPath, text matching, coordinates
4. **Page State Recovery**: Handle modals, errors, timeouts
5. **Fallback Navigation**: Alternative navigation paths
6. **Human Intervention**: Manual assistance (optional)

## 📊 The 6 Entry Points

1. **OpenAI Chat Completions**: `POST /v1/chat/completions`
2. **Direct Robot Execute**: `POST /v1/robots/{robot_id}/execute`
3. **Multi-Robot Orchestration**: `POST /v1/robots/orchestrate`
4. **Vision Analysis**: `POST /v1/vision/analyze`
5. **Execution Stream**: `GET /v1/executions/{id}/stream`
6. **Batch Operations**: `POST /v1/robots/batch`

## 🎯 Key Features

- ✅ OpenAI SDK Compatible
- ✅ Real-Time Streaming (SSE)
- ✅ Vision-Based Error Resolution
- ✅ Iterative Resolution (up to 6 attempts)
- ✅ Auto-Scaling (2-20 instances)
- ✅ Multi-Region Deployment
- ✅ High Availability (99.9% SLA)
- ✅ Cost Optimized
- ✅ Production Ready

## 📚 Documentation

For complete documentation with examples, see the full README in docs/.

## 🔗 Links

- Main Docs: `../docs/BROWSER_AUTOMATION_CHAT.md`
- API Docs: `http://localhost:8080/docs`
- OpenAPI Spec: `http://localhost:8080/api/v1/openapi.json`
