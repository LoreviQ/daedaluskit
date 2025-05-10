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
    data?: string;
    ttl: number; // Duration in milliseconds
    expiresAt: number; // Timestamp in milliseconds
    initialize?(agent: Agent): Promise<void>;
    gather(): Promise<string>;
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
    expiresAt: number;
    data?: string;

    constructor(
        key: string,
        options: {
            order: number;
            type: RuneType;
            name: string;
            description: string;
            ttlString: string; // e.g., "5m"
            config?: Config;
        }
    ) {
        this.key = key;
        this.order = options.order;
        this.type = options.type;
        this.name = options.name;
        this.description = options.description;
        this.config = options.config;

        const parsedTtl = (ms as (value: string) => number | undefined)(
            options.ttlString
        );
        if (typeof parsedTtl !== "number") {
            console.warn(
                `[Rune: ${this.key}] Invalid TTL string: "${options.ttlString}". Defaulting to 0ms (will always revalidate).`
            );
            this.ttl = 0;
        } else {
            this.ttl = parsedTtl;
        }
        this.expiresAt = 0;
    }

    abstract initialize?(agent: Agent): Promise<void>;
    abstract gather(): Promise<string>;

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
