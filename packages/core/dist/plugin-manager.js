"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginManager = void 0;
class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.toolHandlers = new Map();
    }
    setEventEmitter(emitter) {
        this.eventEmitter = emitter;
    }
    async load(plugin) {
        const context = {
            registerTool: (name, handler) => this.toolHandlers.set(name, handler),
            emit: (event, data) => this.eventEmitter?.(event, data),
        };
        if (plugin.onLoad)
            await plugin.onLoad(context);
        if (plugin.tools) {
            for (const tool of plugin.tools) {
                this.toolHandlers.set(tool.name, tool.handler);
            }
        }
        this.plugins.set(plugin.id, plugin);
    }
    async unload(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (plugin?.onUnload)
            await plugin.onUnload();
        if (plugin?.tools) {
            for (const tool of plugin.tools) {
                this.toolHandlers.delete(tool.name);
            }
        }
        this.plugins.delete(pluginId);
    }
    getPlugin(id) {
        return this.plugins.get(id);
    }
    getAllPlugins() {
        return Array.from(this.plugins.values());
    }
    async executeTool(name, args) {
        const handler = this.toolHandlers.get(name);
        if (!handler)
            throw new Error(`Plugin tool not found: ${name}`);
        return handler(args);
    }
    getToolNames() {
        return Array.from(this.toolHandlers.keys());
    }
}
exports.PluginManager = PluginManager;
//# sourceMappingURL=plugin-manager.js.map