"""
Mock Rapid-MLX 서버 - 테스트 및 검증용
실제 Rapid-MLX 클론이 필요없이 OpenAI 호환 API를 제공합니다.
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
from datetime import datetime

app = FastAPI(title="Rapid-MLX Mock Server", version="1.0")

# 모델 정의
AVAILABLE_MODELS = [
    {
        "id": "qwen3.5-9b-4bit",
        "object": "model",
        "owned_by": "qwen",
        "permission": [],
    },
    {
        "id": "deepseek-r1-14b-4bit",
        "object": "model",
        "owned_by": "deepseek",
        "permission": [],
    },
    {
        "id": "nomic-embed-text",
        "object": "model",
        "owned_by": "nomic",
        "permission": [],
    },
]

# 요청/응답 모델
class Message(BaseModel):
    role: str
    content: str

class ToolFunction(BaseModel):
    name: str
    arguments: str

class ToolCall(BaseModel):
    id: str
    type: str = "function"
    function: ToolFunction

class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[Message]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 2048
    tools: Optional[List[Dict[str, Any]]] = None
    tool_choice: Optional[str] = None

class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, int]

# 헬스 체크
@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# 모델 목록
@app.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": AVAILABLE_MODELS,
    }

# 채팅 완료 (OpenAI 호환 API)
@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    # 모델 검증
    valid_models = [m["id"] for m in AVAILABLE_MODELS]
    if request.model not in valid_models:
        raise HTTPException(status_code=400, detail=f"Model {request.model} not found")
    
    # Mock 응답 생성
    user_message = next(
        (m.content for m in request.messages if m.role == "user"),
        "질문이 없습니다"
    )
    
    # 도구 호출이 포함된 경우
    response_message = {
        "role": "assistant",
        "content": f"Mock response for: {user_message[:50]}...",
    }
    
    # 도구가 전달된 경우 도구 호출 추가
    if request.tools and request.tool_choice != "none":
        tool_name = request.tools[0].get("name", "test_tool") if request.tools else "test_tool"
        response_message["tool_calls"] = [
            {
                "id": "call_123",
                "type": "function",
                "function": {
                    "name": tool_name,
                    "arguments": '{"input": "test"}',
                },
            }
        ]
    
    response = {
        "id": "chatcmpl-mock",
        "object": "chat.completion",
        "created": int(datetime.now().timestamp()),
        "model": request.model,
        "choices": [
            {
                "index": 0,
                "message": response_message,
                "finish_reason": "tool_calls" if request.tools else "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 10,
            "total_tokens": 20,
        },
    }
    
    return response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
