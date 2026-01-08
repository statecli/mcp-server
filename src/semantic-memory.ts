import * as path from 'path';
import * as fs from 'fs';
import { StateCLI } from './statecli';
import { StateChange } from './types';
import { LocalIndex } from 'vectra';

// Lazy load pipeline to avoid import issues before install
let pipeline: any;

export interface SemanticQueryResult {
    change: StateChange;
    score: number;
    summary: string;
}

export class SemanticMemory {
    private statecli: StateCLI;
    private memoryDir: string;
    private index: LocalIndex | null = null;
    private modelPromise: Promise<any> | null = null;

    constructor(statecli: StateCLI, memoryDir?: string) {
        this.statecli = statecli;
        this.memoryDir = memoryDir || path.join(process.cwd(), '.statecli', 'semantic');
        this.ensureMemoryDir();
    }

    private ensureMemoryDir(): void {
        if (!fs.existsSync(this.memoryDir)) {
            fs.mkdirSync(this.memoryDir, { recursive: true });
        }
    }

    private async getIndex(): Promise<LocalIndex> {
        if (this.index) return this.index;

        const index = new LocalIndex(path.join(this.memoryDir, 'index'));

        if (!await index.isIndexCreated()) {
            await index.createIndex();
        }

        this.index = index;
        return index;
    }

    private async getEmbedding(text: string): Promise<number[]> {
        if (!this.modelPromise) {
            // Dynamic import to handle post-install
            // Dynamic import to handle post-install and ESM in CJS
            const dynamicImport = new Function('modulePath', 'return import(modulePath)');
            const { pipeline: p } = await dynamicImport('@xenova/transformers');
            pipeline = p;
            this.modelPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        }

        const extractor = await this.modelPromise;
        const output = await extractor(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }

    /**
     * Index a state change for semantic search
     */
    async indexChange(change: StateChange): Promise<void> {
        try {
            const index = await this.getIndex();

            // Create a rich text representation of the change
            const text = `
        Entity: ${change.entity}
        Actor: ${change.actor}
        Action: Modified ${change.entity}
        Content: ${JSON.stringify(change.after)}
        Timestamp: ${change.timestamp}
      `.trim();

            const vector = await this.getEmbedding(text);

            await index.insertItem({
                vector,
                metadata: {
                    id: change.id,
                    entity: change.entity,
                    actor: change.actor,
                    timestamp: change.timestamp,
                    summary: text
                }
            });
            await index.endUpdate();
        } catch (error) {
            console.error('Failed to index change semantically:', error);
        }
    }

    /**
     * Search memory using natural language
     */
    async search(query: string, limit: number = 5): Promise<SemanticQueryResult[]> {
        try {
            const index = await this.getIndex();
            const vector = await this.getEmbedding(query);
            const results = await index.queryItems(vector, query, limit);

            return results.map(item => ({
                change: {
                    id: item.item.metadata.id as string,
                    entity: item.item.metadata.entity as string,
                    entityType: 'unknown', // Reconstructed from index
                    entityId: item.item.metadata.entity as string,
                    actor: item.item.metadata.actor as string,
                    timestamp: item.item.metadata.timestamp as string,
                    // Reconstruct partial change object from metadata
                    before: null,
                    after: {}, // Empty object instead of null to match Record<string, unknown>
                    checkpointName: undefined
                } as StateChange,
                score: item.score,
                summary: item.item.metadata.summary as string
            }));
        } catch (error) {
            console.error('Semantic search failed:', error);
            return [];
        }
    }
}
