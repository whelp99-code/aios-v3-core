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
export declare class PluginManager {
    private plugins;
    private toolHandlers;
    private eventEmitter?;
    setEventEmitter(emitter: (event: string, data: unknown) => void): void;
    load(plugin: AIOSPlugin): Promise<void>;
    unload(pluginId: string): Promise<void>;
    getPlugin(id: string): AIOSPlugin | undefined;
    getAllPlugins(): AIOSPlugin[];
    executeTool(name: string, args: Record<string, unknown>): Promise<unknown>;
    getToolNames(): string[];
}
