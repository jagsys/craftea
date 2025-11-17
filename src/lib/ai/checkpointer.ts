import { BaseCheckpointSaver, Checkpoint, CheckpointMetadata, CheckpointTuple, PendingWrite } from '@langchain/langgraph';

export class MemorySaver extends BaseCheckpointSaver {
  private storage: Map<string, CheckpointTuple> = new Map();

  async getTuple(config: { configurable?: { thread_id: string } }): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return undefined;
    return this.storage.get(threadId);
  }

  async *list(config: { configurable?: { thread_id: string } }): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return;

    const tuple = this.storage.get(threadId);
    if (tuple) {
      yield tuple;
    }
  }

  async put(
    config: { configurable?: { thread_id: string } },
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<{ configurable: { thread_id: string } }> {
    const threadId = config.configurable?.thread_id || this.generateThreadId();

    this.storage.set(threadId, {
      config: { configurable: { thread_id: threadId } },
      checkpoint,
      metadata,
      parentConfig: config.configurable?.thread_id ? config : undefined,
    });

    return { configurable: { thread_id: threadId } };
  }

  async putWrites(
    config: { configurable?: { thread_id: string } },
    writes: PendingWrite[],
    taskId: string
  ): Promise<void> {
    // For in-memory implementation, we don't need to persist pending writes
    // They will be handled by the checkpoint system
    return;
  }

  private generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
