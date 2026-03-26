export interface AgentRuntime {
  onBeforeFileWrite?: (path: string, content: string) => Promise<void>;
  onBeforeAPICall?: (url: string, method: string) => Promise<void>;
}

export class StateCLIMiddleware {
  constructor(private checkpointFn: (entity: string) => Promise<any> | any) {}

  wrapAgent(agent: AgentRuntime) {
    agent.onBeforeFileWrite = async (path: string, content: string) => {
      await this.autoCheckpoint(`file:${path}`);
    };
    agent.onBeforeAPICall = async (url: string, method: string) => {
      if (this.isMutating(method)) {
        await this.autoCheckpoint(`api:${url}`);
      }
    };
  }

  private async autoCheckpoint(entity: string) {
    await this.checkpointFn(entity);
  }

  private isMutating(method: string) {
    return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  }
}
