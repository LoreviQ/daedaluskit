import { Edict } from "./edict";

export interface GatewayOutput {
    finalTextResponse?: string;
    executedEdicts?: { key: string; args: any; result: any; error?: string }[];
    rawLLMResponse?: any;
    usageData?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface LLMCallParams {
    maxOutputTokens?: number;
    temperature?: number;
    // ... other common LLM params
}

export interface Gateway<Config = any> {
    readonly key: string; // Unique identifier
    config?: Config;
    name: string;
    contextWindow: number; // Maximum number of tokens the gateway can support
    tokenize(text: string): Promise<number>;
    process(
        systemPrompt: string,
        userPrompt: string,
        edicts: Edict<any, any, any>[],
        llmParams: LLMCallParams
    ): Promise<GatewayOutput>;
}
