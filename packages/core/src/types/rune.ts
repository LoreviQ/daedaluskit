import { Agent } from "../agent";
import ms from "ms";

export type RuneType = "system" | "prompt";

export interface RuneData {
    runeKey: string;
    content: string;
    type: RuneType;
    order: number;
    chars: number;
    tokens?: number;
}

export interface IRune<Config = any> {
    readonly key: string; // Unique identifier
    config?: Config;
    order: number;
    type: RuneType;
    name: string;
    description: string;
    ttl: number; // Duration in milliseconds
    initialize?(agent: Agent): Promise<void>;
    getData(revalidate?: boolean): Promise<RuneData>;
}

export abstract class Rune<Config = any> implements IRune<Config> {
    readonly key: string;
    config?: Config;
    order: number;
    type: RuneType;
    name: string;
    description: string;
    ttl: number;

    protected data?: string;
    protected expiresAt: number;

    constructor(
        key: string,
        order: number,
        type: RuneType,
        name: string,
        description: string,
        ttlString: string, // e.g., "5m"
        config?: Config
    ) {
        this.key = key;
        this.order = order;
        this.type = type;
        this.name = name;
        this.description = description;
        this.config = config;

        const parsedTtl = (ms as (value: string) => number | undefined)(
            ttlString
        );
        if (typeof parsedTtl !== "number") {
            console.warn(
                `[Rune: ${this.key}] Invalid TTL string: "${ttlString}". Defaulting to 0ms (will always revalidate).`
            );
            this.ttl = 0;
        } else {
            this.ttl = parsedTtl;
        }
        this.expiresAt = 0;
    }

    public async initialize?(agent: Agent): Promise<void>;
    protected abstract gather(): Promise<string>;

    async getData(revalidate: boolean = false): Promise<RuneData> {
        if (
            revalidate ||
            this.data === undefined ||
            this.ttl <= 0 ||
            Date.now() >= this.expiresAt
        ) {
            this.data = await this.gather();
            if (this.ttl > 0) {
                this.expiresAt = Date.now() + this.ttl;
            }
        }
        return {
            runeKey: this.key,
            content: this.data,
            type: this.type,
            order: this.order,
            chars: this.data.length,
            tokens: undefined, // To be populated by the context builder
        };
    }
}
