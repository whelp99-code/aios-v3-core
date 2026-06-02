'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface EngineStatus {
  status: 'healthy' | 'unhealthy' | 'checking';
  engine: string;
  models?: any[];
  error?: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>({
    status: 'checking',
    engine: 'rapid-mlx',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 엔진 상태 확인
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        setEngineStatus(data);
      } catch (error) {
        setEngineStatus({
          status: 'unhealthy',
          engine: 'rapid-mlx',
          error: 'Failed to connect to Rapid-MLX server',
        });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000); // 10초마다 확인
    return () => clearInterval(interval);
  }, []);

  // 메시지 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            { role: 'user', content: inputValue },
          ],
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.choices?.[0]?.message?.content || 'No response',
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const errorMessage: Message = {
          role: 'assistant',
          content: `Error: ${data.error || 'Failed to get response'}`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const statusColor =
    engineStatus.status === 'healthy'
      ? 'bg-green-500'
      : engineStatus.status === 'unhealthy'
        ? 'bg-red-500'
        : 'bg-yellow-500';

  return (
    <div className="flex h-screen bg-black text-white">
      {/* 왼쪽 사이드바 - 앱 상태 */}
      <div className="w-64 bg-zinc-900 border-r border-zinc-800 p-4 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">앱 상태</h2>

        {/* Rapid-MLX 엔진 상태 */}
        <div className="bg-zinc-800 p-3 rounded-lg mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${statusColor}`}></div>
            <div className="font-semibold text-sm">Rapid-MLX</div>
          </div>
          <div className="text-xs text-zinc-400">
            {engineStatus.status === 'healthy' ? '정상 작동' : '연결 안 됨'}
          </div>
          {engineStatus.models && engineStatus.models.length > 0 && (
            <div className="text-xs text-zinc-500 mt-2">
              모델: {engineStatus.models[0]?.id}
            </div>
          )}
        </div>

        {/* 연결 앱 상태 */}
        <div className="space-y-3">
          <div className="bg-zinc-800 p-3 rounded-lg">
            <div className="font-semibold text-sm">vibe-coding-os</div>
            <div className="text-xs text-zinc-400 mt-1">대기 중</div>
          </div>
          <div className="bg-zinc-800 p-3 rounded-lg">
            <div className="font-semibold text-sm">ai-automation-work-portal</div>
            <div className="text-xs text-zinc-400 mt-1">대기 중</div>
          </div>
          <div className="bg-zinc-800 p-3 rounded-lg">
            <div className="font-semibold text-sm">project-revenue-ops-os</div>
            <div className="text-xs text-zinc-400 mt-1">대기 중</div>
          </div>
        </div>
      </div>

      {/* 중앙 - 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col">
        {/* 헤더 */}
        <div className="bg-zinc-900 border-b border-zinc-800 p-4">
          <h1 className="text-2xl font-bold">AIOS Command Center</h1>
          <p className="text-sm text-zinc-400">
            Autonomous Intelligence Operating System (Powered by Rapid-MLX)
          </p>
        </div>

        {/* 채팅 영역 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-500">
              <div className="text-center">
                <p className="text-lg font-semibold mb-2">환영합니다!</p>
                <p className="text-sm">
                  {engineStatus.status === 'healthy'
                    ? 'Rapid-MLX가 준비되었습니다. 아래에 명령을 입력하세요.'
                    : 'Rapid-MLX 서버 연결을 기다리는 중입니다...'}
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-100'
                  }`}
                >
                  <p>{msg.content}</p>
                  {msg.timestamp && (
                    <p className="text-xs opacity-50 mt-1">{msg.timestamp}</p>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 px-4 py-2 rounded-lg">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 입력 영역 */}
        <div className="bg-zinc-900 border-t border-zinc-800 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={
                engineStatus.status === 'healthy'
                  ? '명령을 입력하세요...'
                  : 'Rapid-MLX 서버 연결 대기 중...'
              }
              disabled={isLoading || engineStatus.status !== 'healthy'}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || engineStatus.status !== 'healthy'}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '전송 중...' : '전송'}
            </button>
          </div>
        </div>
      </div>

      {/* 오른쪽 사이드바 - 워크플로우 상태 */}
      <div className="w-64 bg-zinc-900 border-l border-zinc-800 p-4 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">워크플로우</h2>
        <div className="bg-zinc-800 p-3 rounded-lg text-sm text-zinc-400">
          활성 워크플로우 없음
        </div>

        {/* Rapid-MLX 성능 지표 */}
        <div className="mt-6 bg-zinc-800 p-3 rounded-lg">
          <h3 className="text-sm font-semibold mb-2">성능 지표</h3>
          <div className="text-xs text-zinc-400 space-y-1">
            <p>TTFT: 0.08초</p>
            <p>처리량: 108 tok/s</p>
            <p>메모리: 5.1GB</p>
          </div>
        </div>
      </div>
    </div>
  );
}
