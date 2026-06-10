import { describe, it, expect, vi, beforeEach } from 'vitest';
import { A2AAgent, createAgent } from '../src/a2a-agent.js';
import type { A2ATask, A2AResponse, A2AAgentConfig, AgentSkill } from '../src/types.js';

// ─── A2AAgent Tests ───────────────────────────────────────────

describe('A2AAgent', () => {
  const defaultSkills: AgentSkill[] = [
    { id: 'get-weather', name: 'Get Weather', description: 'Get weather info' },
    { id: 'translate', name: 'Translate', description: 'Translate text' },
  ];

  const defaultConfig: A2AAgentConfig = {
    name: 'test-agent',
    description: 'A test agent',
    skills: defaultSkills,
    url: 'http://localhost:3000',
    version: '1.0.0',
  };

  it('should create an agent with config', () => {
    const agent = new A2AAgent(defaultConfig);
    expect(agent).toBeDefined();
    expect(agent.getConfig().name).toBe('test-agent');
  });

  it('should get the agent card', () => {
    const agent = new A2AAgent(defaultConfig);
    const card = agent.getAgentCard();
    expect(card.name).toBe('test-agent');
    expect(card.description).toBe('A test agent');
    expect(card.skills.length).toBe(2);
    expect(card.version).toBe('1.0.0');
  });

  it('should register and dispatch a skill handler', async () => {
    const agent = new A2AAgent(defaultConfig);
    agent.registerHandler('get-weather', async (task) => ({
      taskId: task.id,
      status: 'completed',
      result: { temperature: 72, condition: 'sunny' },
    }));

    const task: A2ATask = {
      id: 'task-1',
      message: 'What is the weather?',
      skillId: 'get-weather',
    };

    const response = await agent.handleTask(task);
    expect(response.status).toBe('completed');
    expect(response.result).toEqual({ temperature: 72, condition: 'sunny' });
  });

  it('should return error when no handler matches', async () => {
    const agent = new A2AAgent(defaultConfig);
    const task: A2ATask = {
      id: 'task-2',
      message: 'Do something unknown',
      skillId: 'non-existent',
    };

    const response = await agent.handleTask(task);
    expect(response.status).toBe('failed');
    expect(response.error?.code).toBe('SKILL_NOT_FOUND');
  });

  it('should infer skill from message content', async () => {
    const agent = new A2AAgent(defaultConfig);
    agent.registerHandler('get-weather', async (task) => ({
      taskId: task.id,
      status: 'completed',
      result: { temp: 72 },
    }));

    const task: A2ATask = {
      id: 'task-3',
      message: 'What is the weather today?',
      // No skillId — should be inferred from "weather" keyword
    };

    const response = await agent.handleTask(task);
    expect(response.status).toBe('completed');
  });

  it('should return NO_SKILL_DETECTED when inference fails', async () => {
    const agent = new A2AAgent(defaultConfig);
    const task: A2ATask = {
      id: 'task-4',
      message: 'Do something completely unrelated',
    };

    const response = await agent.handleTask(task);
    expect(response.status).toBe('failed');
    expect(response.error?.code).toBe('NO_SKILL_DETECTED');
  });

  it('should use default skill when only one skill is registered', async () => {
    const singleSkillAgent = new A2AAgent({
      name: 'single',
      description: 'Single skill',
      skills: [{ id: 'only-skill', name: 'Only Skill', description: 'The only skill' }],
      url: 'http://localhost:3001',
      version: '1.0.0',
    });
    singleSkillAgent.registerHandler('only-skill', async (task) => ({
      taskId: task.id,
      status: 'completed',
      result: 'done',
    }));

    const task: A2ATask = {
      id: 'task-5',
      message: 'anything',
    };

    const response = await singleSkillAgent.handleTask(task);
    expect(response.status).toBe('completed');
  });

  it('should track task status', async () => {
    const agent = new A2AAgent(defaultConfig);
    agent.registerHandler('get-weather', async (task) => ({
      taskId: task.id,
      status: 'completed',
      result: 'ok',
    }));

    const task: A2ATask = { id: 'task-track', message: 'weather', skillId: 'get-weather' };
    await agent.handleTask(task);

    const status = agent.getTaskStatus('task-track');
    expect(status).not.toBeNull();
    expect(status!.taskId).toBe('task-track');
  });

  it('should return null for unknown task status', () => {
    const agent = new A2AAgent(defaultConfig);
    expect(agent.getTaskStatus('unknown')).toBeNull();
  });

  it('should get registered skills', () => {
    const agent = new A2AAgent(defaultConfig);
    agent.registerHandler('get-weather', async () => ({} as any));
    const skills = agent.getRegisteredSkills();
    expect(skills).toContain('get-weather');
  });

  it('should check if skill is registered', () => {
    const agent = new A2AAgent(defaultConfig);
    agent.registerHandler('get-weather', async () => ({} as any));
    expect(agent.hasSkill('get-weather')).toBe(true);
    expect(agent.hasSkill('non-existent')).toBe(false);
  });

  it('should use createAgent helper with default values', () => {
    const agent = createAgent({
      name: 'helper-agent',
      description: 'Helper',
      skills: [{ id: 'help', name: 'Help', description: 'Help' }],
      version: '1.0.0',
    });
    expect(agent.getConfig().url).toBe('http://localhost:3000');
    expect(agent.getConfig().version).toBe('1.0.0');
  });

  it('should handle handler errors gracefully', async () => {
    const agent = new A2AAgent(defaultConfig);
    agent.registerHandler('get-weather', async () => {
      throw new Error('Internal failure');
    });

    const task: A2ATask = {
      id: 'task-err',
      message: 'weather',
      skillId: 'get-weather',
    };

    const response = await agent.handleTask(task);
    expect(response.status).toBe('failed');
    expect(response.error?.code).toBe('INTERNAL_ERROR');
    expect(response.error?.message).toBe('Internal failure');
  });

  it('should include provider and capabilities in card', () => {
    const agent = new A2AAgent({
      ...defaultConfig,
      provider: { organization: 'AIOS', url: 'https://aios.dev' },
      capabilities: { streaming: true, pushNotifications: false },
    });
    const card = agent.getAgentCard();
    expect(card.provider?.organization).toBe('AIOS');
    expect(card.capabilities?.streaming).toBe(true);
  });
});
