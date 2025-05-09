import { RuneData } from "./rune";

export interface PromptPackageSettings {
    targetTokens?: number; // The Context will aim for this number of tokens
    modelContextWindow?: number; // The maximum context window of the model, the Context will always be smaller than this
}

export interface Context {
    systemPrompt: string;
    userPrompt: string;
    chunks: RuneData[]; // The individual pieces that formed the prompts
    settings: PromptPackageSettings;
    tokenizer(text: string): Promise<number>; // Function to count tokens
    totalSystemTokens?: number;
    totalUserPromptTokens?: number;
    system(): Promise<string>; // The system prompt
    prompt(): Promise<string>; // The user prompt
}
