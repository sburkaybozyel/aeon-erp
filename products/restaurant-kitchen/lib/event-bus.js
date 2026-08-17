// Simple Event Bus
export class EventBus {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  async emit(event, data) {
    if (!this.listeners[event]) return;
    await Promise.all(this.listeners[event].map(callback => callback(data)));
  }
}

// Hooks System
export class HookRegistry {
  constructor() {
    this.hooks = {};
  }

  register(hookName, providerFn) {
    if (!this.hooks[hookName]) {
      this.hooks[hookName] = [];
    }
    this.hooks[hookName].push(providerFn);
  }

  async call(hookName, context, defaultValues = []) {
    const results = [...defaultValues];
    if (this.hooks[hookName]) {
      for (const provider of this.hooks[hookName]) {
        const res = await provider(context);
        if (Array.isArray(res)) {
          results.push(...res);
        } else if (res) {
          results.push(res);
        }
      }
    }
    return results;
  }
}

export const eventBus = new EventBus();
export const hookRegistry = new HookRegistry();
