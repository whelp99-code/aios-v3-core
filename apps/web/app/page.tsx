'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

interface EngineStatus {
  status: 'healthy' | 'unhealthy' | 'degraded' | 'checking';
  engine: string;
  models?: { modelId?: string; id?: string; provider?: string; displayName?: string }[];
  providers?: Array<{ provider: string; healthy: boolean; error?: string }>;
  resource?: { localLoad: number; localHealthy: boolean; recommendedMode: string; cloudAvailable: boolean };
  preferences?: { mode: string };
  rapidMLX?: { healthy: boolean };
  error?: string;
}

type EngineMode = 'auto' | 'local' | 'cloud';
type CloudProvider = 'mimo' | 'openai' | 'anthropic' | 'huggingface';

interface MCPAdapterStatus {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'simulated' | 'error';
  tools: string[];
  error?: string;
}

interface WorkflowStep {
  agent: string;
  status: 'started' | 'completed';
  output?: string;
  timestamp: string;
}

interface WorkflowState {
  currentAgent?: string;
  plan?: string | null;
  executionResult?: string | null;
  review?: string | null;
  lastOutput?: string | null;
  subTasks?: { id: string; description: string; priority: number; status?: string; assignedEngine?: string }[];
  mcpToolResults?: { toolName: string; adapterId: string; success: boolean }[];
  consensusResult?: { verdict: string; confidence: number; summary: string; reviewers?: { provider: string; modelId: string; verdict: string }[] };
  agentTeam?: { role: string; model: string; provider?: string }[];
  engineMode?: string;
}

const AGENT_LABELS: Record<string, string> = {
  planner: 'Planner',
  executor: 'Executor',
  critic: 'Critic',
  user_approval: 'User Approval',
  self_corrector: 'Self-Corrector',
  knowledge_updater: 'Knowledge Updater',
  completed: 'Completed',
  failed: 'Failed',
};

const MCP_STATUS_LABELS: Record<string, string> = {
  connected: '연결됨',
  simulated: '시뮬레이션',
  disconnected: '연결 안 됨',
  error: '오류',
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useWorkflow, setUseWorkflow] = useState(true);
  const [engineMode, setEngineMode] = useState<EngineMode>('auto');
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('mimo');
  const [parallelExecution, setParallelExecution] = useState(true);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>({
    status: 'checking',
    engine: 'rapid-mlx',
  });
  const [mcpAdapters, setMcpAdapters] = useState<MCPAdapterStatus[]>([]);
  const [workflowSessionId, setWorkflowSessionId] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<string>('idle');
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'workflow' | 'knowledge' | 'evolution'>('workflow');
  const [knowledgeStats, setKnowledgeStats] = useState<{ nodeCount: number; edgeCount: number; byType: Record<string, number> } | null>(null);
  const [knowledgeNodes, setKnowledgeNodes] = useState<{ id: string; label: string; type: string }[]>([]);
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [knowledgeAnswer, setKnowledgeAnswer] = useState('');
  const [evolutionProposals, setEvolutionProposals] = useState<{ id: string; status: string; description: string; patches: { filePath: string }[] }[]>([]);
  const [systemStats, setSystemStats] = useState<Record<string, unknown> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setEngineStatus(data);
      if (data.preferences?.mode) {
        setEngineMode(data.preferences.mode as EngineMode);
      }
    } catch {
      setEngineStatus({
        status: 'unhealthy',
        engine: 'hybrid',
        error: 'Failed to connect to AI engine',
      });
    }
  }, []);

  const updateEngineMode = useCallback(async (mode: EngineMode) => {
    setEngineMode(mode);
    await fetch('/api/engines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, preferredCloudProvider: cloudProvider }),
    });
    checkHealth();
  }, [checkHealth, cloudProvider]);

  const updateCloudProvider = useCallback(async (provider: CloudProvider) => {
    setCloudProvider(provider);
    await fetch('/api/engines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: engineMode, preferredCloudProvider: provider }),
    });
    checkHealth();
  }, [checkHealth, engineMode]);

  const checkMCPStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/mcp/status');
      const data = await response.json();
      setMcpAdapters(data.adapters ?? []);
    } catch {
      setMcpAdapters([]);
    }
  }, []);

  const fetchKnowledge = useCallback(async () => {
    try {
      const response = await fetch('/api/knowledge');
      const data = await response.json();
      setKnowledgeStats(data.stats);
      setKnowledgeNodes(data.nodes?.slice(-10) ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchEvolution = useCallback(async () => {
    try {
      const response = await fetch('/api/evolution');
      const data = await response.json();
      setEvolutionProposals(data.proposals ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchSystemStats = useCallback(async () => {
    try {
      const response = await fetch('/api/stats');
      setSystemStats(await response.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    checkHealth();
    checkMCPStatus();
    fetchKnowledge();
    fetchEvolution();
    fetchSystemStats();
    const interval = setInterval(() => {
      checkHealth();
      checkMCPStatus();
      fetchKnowledge();
      fetchEvolution();
      fetchSystemStats();
    }, 10000);
    return () => clearInterval(interval);
  }, [checkHealth, checkMCPStatus, fetchKnowledge, fetchEvolution, fetchSystemStats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const pollWorkflow = useCallback(
    (sessionId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/workflow?sessionId=${sessionId}`);
          const data = await response.json();

          setWorkflowStatus(data.status);
          setWorkflowSteps(data.steps ?? []);
          if (data.state) setWorkflowState(data.state);

          if (data.status === 'pending_approval') {
            setPendingApproval(true);
            setIsLoading(false);
          }

          if (data.status === 'completed' || data.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            setIsLoading(false);
            setPendingApproval(false);

            const summary =
              data.state?.lastOutput ??
              data.state?.executionResult ??
              `Workflow ${data.status}`;

            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: summary,
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          setIsLoading(false);
        }
      }, 1000);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleApproval = async (approved: boolean) => {
    if (!workflowSessionId) return;

    await fetch(`/api/workflow/${workflowSessionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    });

    setPendingApproval(false);
    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      {
        role: 'system',
        content: approved ? '✅ 계획이 승인되었습니다. 실행을 계속합니다.' : '❌ 계획이 거부되었습니다. 재계획 중...',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const taskInput = inputValue;
    setInputValue('');
    setIsLoading(true);
    setWorkflowSteps([]);
    setWorkflowState(null);
    setWorkflowStatus('running');

    if (useWorkflow) {
      try {
        const response = await fetch('/api/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskInput, autoApprove: false, engineMode, parallelExecution }),
        });

        const data = await response.json();

        if (response.ok) {
          setWorkflowSessionId(data.sessionId);
          pollWorkflow(data.sessionId);
        } else {
          throw new Error(data.error || 'Workflow failed to start');
        }
      } catch (error) {
        setIsLoading(false);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Workflow error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      return;
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role === 'system' ? 'assistant' : m.role, content: m.content })),
            { role: 'user', content: taskInput },
          ],
        }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.ok
            ? data.choices?.[0]?.message?.content || 'No response'
            : `Error: ${data.error || 'Failed to get response'}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const statusColor =
    engineStatus.status === 'healthy'
      ? 'bg-green-500'
      : engineStatus.status === 'degraded'
        ? 'bg-yellow-500'
        : engineStatus.status === 'unhealthy'
          ? 'bg-red-500'
          : 'bg-yellow-500';

  const mcpStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'simulated':
        return 'bg-blue-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-zinc-500';
    }
  };

  const handleEvolutionAction = async (proposalId: string, action: 'approve' | 'reject' | 'apply') => {
    await fetch('/api/evolution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId, action }),
    });
    fetchEvolution();
  };

  const handleKnowledgeQuery = async () => {
    if (!knowledgeQuery.trim()) return;
    const response = await fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'query', question: knowledgeQuery }),
    });
    const data = await response.json();
    setKnowledgeAnswer(data.answer ?? 'No results');
  };

  const getAgentStepStatus = (agent: string) => {
    const completed = workflowSteps.some((s) => s.agent === agent && s.status === 'completed');
    const started = workflowSteps.some((s) => s.agent === agent && s.status === 'started');
    if (completed) return 'completed';
    if (started) return 'active';
    if (workflowState?.currentAgent === agent) return 'active';
    return 'pending';
  };

  return (
    <div className="flex h-screen bg-black text-white">
      {/* Left sidebar - App status */}
      <div className="w-64 bg-zinc-900 border-r border-zinc-800 p-4 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">앱 상태</h2>

        <div className="bg-zinc-800 p-3 rounded-lg mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${statusColor}`} />
            <div className="font-semibold text-sm">Hybrid AI Core</div>
          </div>
          <div className="text-xs text-zinc-400">
            {engineStatus.status === 'healthy'
              ? '로컬/클라우드 사용 가능'
              : engineStatus.status === 'degraded'
                ? 'Fallback 모드 (일부 엔진)'
                : 'Fallback 모드'}
          </div>
          {engineStatus.resource && (
            <div className="text-xs text-zinc-500 mt-2">
              로컬 부하: {Math.round(engineStatus.resource.localLoad * 100)}% · 권장: {engineStatus.resource.recommendedMode}
            </div>
          )}
        </div>

        <h3 className="text-sm font-semibold mb-2 text-zinc-400">엔진 모드</h3>
        <div className="flex gap-1 mb-4">
          {(['auto', 'local', 'cloud'] as EngineMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => updateEngineMode(mode)}
              className={`flex-1 py-1.5 text-xs rounded-lg font-medium uppercase ${
                engineMode === mode ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {mode === 'auto' ? '자동' : mode === 'local' ? '로컬' : '클라우드'}
            </button>
          ))}
        </div>

        <h3 className="text-sm font-semibold mb-2 text-zinc-400">클라우드 Provider</h3>
        <div className="flex gap-1 mb-4">
          {(['mimo', 'huggingface', 'openai', 'anthropic'] as CloudProvider[]).map((provider) => (
            <button
              key={provider}
              onClick={() => updateCloudProvider(provider)}
              className={`flex-1 py-1.5 text-xs rounded-lg font-medium ${
                cloudProvider === provider ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {provider === 'mimo'
                ? 'MiMo'
                : provider === 'huggingface'
                  ? 'HF'
                  : provider === 'openai'
                    ? 'GPT'
                    : 'Claude'}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-400 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={parallelExecution}
            onChange={(e) => setParallelExecution(e.target.checked)}
            className="rounded"
          />
          병렬 Swarm (서브태스크 동시 실행)
        </label>

        <h3 className="text-sm font-semibold mb-2 text-zinc-400">Provider 상태</h3>
        <div className="space-y-2 mb-4">
          {(engineStatus.providers ?? [
            { provider: 'local', healthy: engineStatus.rapidMLX?.healthy ?? false },
          ]).map((p) => (
            <div key={p.provider} className="bg-zinc-800 p-2 rounded-lg flex items-center justify-between">
              <span className="text-xs font-medium">
                {p.provider === 'mimo'
                  ? 'MiMo'
                  : p.provider === 'huggingface'
                    ? '🤗 HuggingFace'
                    : p.provider}
              </span>
              <span className={`text-xs ${p.healthy ? 'text-green-400' : 'text-zinc-500'}`}>
                {p.healthy ? '●' : '○'}
              </span>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-semibold mb-2 text-zinc-400">MCP 연동 앱</h3>
        <div className="space-y-3">
          {(mcpAdapters.length > 0
            ? mcpAdapters
            : [
                { id: 'vibe-coding-os', name: 'vibe-coding-os', status: 'disconnected' as const, tools: [] },
                { id: 'ai-automation-work-portal', name: 'ai-automation-work-portal', status: 'disconnected' as const, tools: [] },
                { id: 'project-revenue-ops-os', name: 'project-revenue-ops-os', status: 'disconnected' as const, tools: [] },
              ]
          ).map((adapter) => (
            <div key={adapter.id} className="bg-zinc-800 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${mcpStatusColor(adapter.status)}`} />
                <div className="font-semibold text-sm">{adapter.name}</div>
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                {MCP_STATUS_LABELS[adapter.status] ?? adapter.status}
              </div>
              {adapter.tools.length > 0 && (
                <div className="text-xs text-zinc-500 mt-1">{adapter.tools.length} tools</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Center - Main content */}
      <div className="flex-1 flex flex-col">
        <div className="bg-zinc-900 border-b border-zinc-800 p-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">AIOS Command Center</h1>
            <p className="text-sm text-zinc-400">
              Swarm Orchestrator + MCP Integration
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={useWorkflow}
              onChange={(e) => setUseWorkflow(e.target.checked)}
              className="rounded"
            />
            Swarm Workflow
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-500">
              <div className="text-center">
                <p className="text-lg font-semibold mb-2">환영합니다!</p>
                <p className="text-sm">
                  {useWorkflow
                    ? 'Swarm Workflow 모드: 멀티 에이전트가 협력하여 태스크를 수행합니다.'
                    : 'Direct Chat 모드: Rapid-MLX에 직접 질의합니다.'}
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-lg px-4 py-2 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : msg.role === 'system'
                        ? 'bg-yellow-900/50 text-yellow-200 text-sm'
                        : 'bg-zinc-800 text-zinc-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.timestamp && <p className="text-xs opacity-50 mt-1">{msg.timestamp}</p>}
                </div>
              </div>
            ))
          )}

          {pendingApproval && workflowState?.plan && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mx-4">
              <h3 className="font-semibold text-yellow-200 mb-2">계획 승인 필요</h3>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap mb-4 max-h-40 overflow-y-auto">
                {workflowState.plan.slice(0, 500)}
                {workflowState.plan.length > 500 ? '...' : ''}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleApproval(true)}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  승인
                </button>
                <button
                  onClick={() => handleApproval(false)}
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  거부
                </button>
              </div>
            </div>
          )}

          {isLoading && !pendingApproval && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 px-4 py-2 rounded-lg">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-zinc-900 border-t border-zinc-800 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="명령을 입력하세요..."
              disabled={isLoading}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '실행 중...' : '전송'}
            </button>
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-80 bg-zinc-900 border-l border-zinc-800 p-4 overflow-y-auto">
        <div className="flex gap-1 mb-4">
          {(['workflow', 'knowledge', 'evolution'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              className={`flex-1 py-1.5 text-xs rounded-lg font-medium capitalize ${
                sidebarTab === tab ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {tab === 'workflow' ? '워크플로우' : tab === 'knowledge' ? '지식' : '진화'}
            </button>
          ))}
        </div>

        {sidebarTab === 'workflow' && (
          <>
            <h2 className="text-lg font-bold mb-4">워크플로우</h2>
            {workflowStatus === 'idle' ? (
              <div className="bg-zinc-800 p-3 rounded-lg text-sm text-zinc-400">활성 워크플로우 없음</div>
            ) : (
              <>
                <div className="bg-zinc-800 p-3 rounded-lg mb-4">
                  <div className="text-xs text-zinc-500 mb-1">상태</div>
                  <div className="text-sm font-medium capitalize">{workflowStatus}</div>
                </div>
                <div className="space-y-2 mb-4">
                  {['planner', 'user_approval', 'executor', 'critic', 'knowledge_updater', 'completed'].map((agent) => {
                    const stepStatus = getAgentStepStatus(agent);
                    return (
                      <div
                        key={agent}
                        className={`p-2 rounded-lg text-sm flex items-center gap-2 ${
                          stepStatus === 'active'
                            ? 'bg-blue-900/50 border border-blue-700'
                            : stepStatus === 'completed'
                              ? 'bg-green-900/30 border border-green-800'
                              : 'bg-zinc-800/50'
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            stepStatus === 'active'
                              ? 'bg-blue-400 animate-pulse'
                              : stepStatus === 'completed'
                                ? 'bg-green-400'
                                : 'bg-zinc-600'
                          }`}
                        />
                        {AGENT_LABELS[agent] ?? agent}
                      </div>
                    );
                  })}
                </div>
                {workflowState?.consensusResult && (
                  <div className="bg-zinc-800 p-3 rounded-lg mb-4">
                    <h3 className="text-sm font-semibold mb-1">Multi-Engine Consensus</h3>
                    <div className="text-xs text-zinc-400">
                      {workflowState.consensusResult.verdict} ({Math.round(workflowState.consensusResult.confidence * 100)}%)
                    </div>
                    {workflowState.consensusResult.reviewers && (
                      <div className="mt-2 space-y-1">
                        {workflowState.consensusResult.reviewers.map((r) => (
                          <div key={`${r.provider}-${r.modelId}`} className="text-xs text-zinc-500">
                            {r.provider}: {r.verdict}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {workflowState?.subTasks && workflowState.subTasks.length > 0 && (
                  <div className="bg-zinc-800 p-3 rounded-lg mb-4">
                    <h3 className="text-sm font-semibold mb-2">Sub-Tasks (Swarm)</h3>
                    {workflowState.subTasks.map((st) => (
                      <div key={st.id} className="text-xs text-zinc-400 mb-1">
                        [{st.status ?? 'pending'}] {st.description.slice(0, 40)}
                        {st.assignedEngine && <span className="text-zinc-600"> · {st.assignedEngine}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {workflowState?.agentTeam && workflowState.agentTeam.length > 0 && (
                  <div className="bg-zinc-800 p-3 rounded-lg mb-4">
                    <h3 className="text-sm font-semibold mb-2">Agent Team</h3>
                    {workflowState.agentTeam.map((m) => (
                      <div key={m.role} className="text-xs text-zinc-400 mb-1">
                        {m.role}: {m.provider}/{m.model}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {sidebarTab === 'knowledge' && (
          <>
            <h2 className="text-lg font-bold mb-4">지식 그래프</h2>
            {knowledgeStats && (
              <div className="bg-zinc-800 p-3 rounded-lg mb-4 text-xs text-zinc-400 space-y-1">
                <p>노드: {knowledgeStats.nodeCount}</p>
                <p>엣지: {knowledgeStats.edgeCount}</p>
                {Object.entries(knowledgeStats.byType).map(([type, count]) => (
                  <p key={type}>{type}: {count as number}</p>
                ))}
              </div>
            )}
            <div className="mb-4">
              <input
                value={knowledgeQuery}
                onChange={(e) => setKnowledgeQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleKnowledgeQuery()}
                placeholder="지식 그래프 질의..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white mb-2"
              />
              <button onClick={handleKnowledgeQuery} className="w-full bg-purple-600 hover:bg-purple-700 py-1.5 rounded-lg text-xs">
                GraphRAG 질의
              </button>
              {knowledgeAnswer && (
                <p className="text-xs text-zinc-400 mt-2 whitespace-pre-wrap max-h-32 overflow-y-auto">{knowledgeAnswer}</p>
              )}
            </div>
            <div className="space-y-1">
              {knowledgeNodes.map((n) => (
                <div key={n.id} className="text-xs bg-zinc-800 p-2 rounded">
                  <span className="text-purple-400">{n.type}</span> {n.label.slice(0, 40)}
                </div>
              ))}
            </div>
          </>
        )}

        {sidebarTab === 'evolution' && (
          <>
            <h2 className="text-lg font-bold mb-4">자가 진화</h2>
            {evolutionProposals.length === 0 ? (
              <div className="bg-zinc-800 p-3 rounded-lg text-sm text-zinc-400">진화 제안 없음</div>
            ) : (
              evolutionProposals.slice(0, 5).map((p) => (
                <div key={p.id} className="bg-zinc-800 p-3 rounded-lg mb-3">
                  <div className="text-xs text-zinc-500 mb-1">{p.id.slice(0, 12)}...</div>
                  <div className="text-sm mb-1 capitalize">{p.status}</div>
                  <p className="text-xs text-zinc-400 mb-2">{p.description.slice(0, 80)}</p>
                  <p className="text-xs text-zinc-500 mb-2">{p.patches.length} patches</p>
                  {(p.status === 'validated' || p.status === 'pending') && (
                    <div className="flex gap-1">
                      <button onClick={() => handleEvolutionAction(p.id, 'approve')} className="flex-1 bg-green-700 py-1 rounded text-xs">승인</button>
                      <button onClick={() => handleEvolutionAction(p.id, 'reject')} className="flex-1 bg-red-700 py-1 rounded text-xs">거부</button>
                    </div>
                  )}
                  {p.status === 'approved' && (
                    <button onClick={() => handleEvolutionAction(p.id, 'apply')} className="w-full bg-blue-700 py-1 rounded text-xs mt-1">Hot-Patch 적용</button>
                  )}
                </div>
              ))
            )}
          </>
        )}

        <div className="mt-6 bg-zinc-800 p-3 rounded-lg">
          <h3 className="text-sm font-semibold mb-2">시스템</h3>
          <div className="text-xs text-zinc-400 space-y-1">
            <p>MCP: {mcpAdapters.filter((a) => a.status === 'connected' || a.status === 'simulated').length}/3</p>
            {systemStats && typeof systemStats.knowledge === 'object' && systemStats.knowledge !== null && (
              <p>Knowledge: {(systemStats.knowledge as { nodeCount: number }).nodeCount} nodes</p>
            )}
            {systemStats && typeof systemStats.evolution === 'object' && systemStats.evolution !== null && (
              <p>Success: {Math.round(((systemStats.evolution as { successRate: number }).successRate ?? 0) * 100)}%</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
