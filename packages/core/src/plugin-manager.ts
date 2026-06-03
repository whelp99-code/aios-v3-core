export interface AIOSPlugin {
  id: string;
  name: string;
  version: string;
  onLoad?: (context: PluginContext) => void | Promise<void>;
  onUnload?: () => void | Promise<void>;
  tools?: Array<{
    name: string;
    description: string;
    handler: (args: Record<string, unknown>) => Promise<unknown>;
  }>;
}

export interface PluginContext {
  registerTool: (name: string, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  emit: (event: string, data: unknown) => void;
}

export class PluginManager {
  private plugins = new Map<string, AIOSPlugin>();
  private toolHandlers = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();
  private eventEmitter?: (event: string, data: unknown) => void;

  setEventEmitter(emitter: (event: string, data: unknown) => void): void {
    this.eventEmitter = emitter;
  }

  async load(plugin: AIOSPlugin): Promise<void> {
    const context: PluginContext = {
      registerTool: (name, handler) => this.toolHandlers.set(name, handler),
      emit: (event, data) => this.eventEmitter?.(event, data),
    };

    if (plugin.onLoad) await plugin.onLoad(context);

    if (plugin.tools) {
      for (const tool of plugin.tools) {
        this.toolHandlers.set(tool.name, tool.handler);
      }
    }

    this.plugins.set(plugin.id, plugin);
  }

  async unload(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin?.onUnload) await plugin.onUnload();
    if (plugin?.tools) {
      for (const tool of plugin.tools) {
        this.toolHandlers.delete(tool.name);
      }
    }
    this.plugins.delete(pluginId);
  }

  getPlugin(id: string): AIOSPlugin | undefined {
    return this.plugins.get(id);
  }

  getAllPlugins(): AIOSPlugin[] {
    return Array.from(this.plugins.values());
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const handler = this.toolHandlers.get(name);
    if (!handler) throw new Error(`Plugin tool not found: ${name}`);
    return handler(args);
  }

  getToolNames(): string[] {
    return Array.from(this.toolHandlers.keys());
  }
}
