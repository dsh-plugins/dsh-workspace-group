import { createConfigClient, type ConfigView } from '@dsh-plugin/dsh-loader/client';
import { changeState, validateState, type GroupChange, type GroupState } from '../model.js';

const configId = 'dsh-workspace-group';

/** 分区写入按顺序执行，使用服务端修订号避免覆盖其他窗口的修改。 */
export class GroupStore {
  private readonly client = createConfigClient(globalThis.fetch.bind(globalThis), url => new EventSource(url));
  private readonly listeners = new Set<() => void>();
  private readonly controller = new AbortController();
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;
  private generation = 0;
  private revision = -1;
  private availability = 0;
  private readonly off: () => void;
  private state: { value: GroupState; ready: boolean; error: string; saving: boolean } = {
    value: { groups: [], assignments: [], defaultCollapsed: false }, ready: false, error: '', saving: false,
  };

  constructor() {
    this.off = this.client.subscribe(() => { void this.refresh(); });
    void this.refresh();
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(patch: Partial<typeof this.state>): void {
    if (this.disposed) {
      return;
    }
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) {
      listener();
    }
  }

  private accept(view: ConfigView): void {
    if (view.revision < this.revision) {
      return;
    }
    const value = view.value as unknown as GroupState;
    validateState(value);
    this.revision = view.revision;
    this.publish({ value, ready: true, error: '' });
  }

  private unavailable(error: unknown): boolean {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'not-found') {
      return false;
    }
    this.availability++;
    this.generation++;
    this.revision = -1;
    this.publish({ ready: false, error: '' });
    return true;
  }

  async refresh(): Promise<void> {
    const generation = ++this.generation;
    try {
      const view = await this.client.read(configId);
      if (generation === this.generation) {
        this.accept(view);
      }
    } catch (error) {
      if (generation === this.generation) {
        if (!this.unavailable(error)) {
          this.publish({ error: `读取工作区分区失败：${errorText(error)}` });
        }
      }
    }
  }

  change(change: GroupChange): Promise<void> {
    const operation = this.queue.then(async () => {
      if (this.disposed) {
        throw new Error('工作区分区插件已卸载。');
      }
      this.generation++;
      const availability = this.availability;
      this.publish({ saving: true, error: '' });
      try {
        const current = await this.client.read(configId);
        if (availability !== this.availability) {
          return;
        }
        const value = changeState(current.value as unknown as GroupState, change);
        const saved = await this.client.update(configId, { ...value }, current.revision, this.controller.signal);
        if (availability === this.availability) {
          this.accept(saved);
        }
      } catch (error) {
        if (availability === this.availability && !this.unavailable(error)) {
          this.publish({ error: `保存工作区分区失败：${errorText(error)}。可重试此操作。` });
        }
        throw error;
      } finally {
        this.publish({ saving: false });
      }
    });
    // 错误已经发布到可见状态；后续操作仍需继续处理。
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
    this.controller.abort();
    this.off();
    this.client.dispose();
    this.listeners.clear();
  }
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
