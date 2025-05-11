import { Logger } from "winston";

import { Edict } from "./edict";
import { Agent } from "../agent";

export interface GatewayOutput {
    finalTextResponse?: string;
    executedEdicts?: { key: string; args: any; result: any; error?: string }[];
    usageData?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
}

/** Optional model configuration parameters.*/
export interface LLMCallParams {
    temperature?: number;
    topP?: number;
    topK?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
    presencePenalty?: number;
    frequencyPenalty?: number;
    seed?: number;
}

export interface IGateway<Config = any> {
    readonly key: string; // Unique identifier
    config?: Config;
    name: string;
    contextWindow: number; // Maximum number of tokens the gateway can support
    agent?: Agent;
    logger?: Logger;
    initialize(agent: Agent): void;
    tokenize(text: string): Promise<number>;
    process(
        systemPrompt: string,
        userPrompt: string,
        edicts: Map<string, Edict>,
        llmParams: LLMCallParams
    ): Promise<GatewayOutput>;
}

export abstract class Gateway<Config = any> implements IGateway<Config> {
    readonly key: string;
    config?: Config;
    name: string;
    contextWindow: number;

    // defined in initialize()
    agent?: Agent;
    logger?: Logger;

    constructor(
        key: string,
        name: string,
        contextWindow: number,
        config?: Config
    ) {
        this.key = key;
        this.name = name;
        this.contextWindow = contextWindow;
        this.config = config;
    }

    public initialize(agent: Agent): void {
        this.agent = agent;
        this.logger = agent.logger.child({ componentKey: this.key });
    }
    public abstract tokenize(text: string): Promise<number>;

    public abstract process(
        systemPrompt: string,
        userPrompt: string,
        edicts: Map<string, Edict>,
        llmParams: LLMCallParams
    ): Promise<GatewayOutput>;
}
