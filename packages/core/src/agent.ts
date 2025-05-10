import {
    Rune,
    RuneData,
    Edict,
    Gateway,
    GatewayOutput,
    LLMCallParams,
} from "./types";

export interface AgentConfig {
    targetTokens?: number; // The Agent will aim for this number of tokens
    maxOutputTokens?: number; // Maximum number of tokens for the LLM output
    temperature?: number; // Temperature for the LLM
}

const DEFAULT_AGENT_CONFIG: AgentConfig = {
    targetTokens: 10000, // Default
    maxOutputTokens: 1024, // Default
    temperature: 0.7, // Default
};

export class Agent {
    private runes: Map<string, Rune> = new Map();
    private edicts: Map<string, Edict> = new Map();
    private gateway?: Gateway;
    public config: AgentConfig;

    constructor(config?: Partial<AgentConfig>) {
        this.config = {
            ...DEFAULT_AGENT_CONFIG,
            ...config,
        };
    }

    addRune(rune: Rune): this {
        if (this.runes.has(rune.key)) {
            console.warn(
                `[Agent] Rune with key '${rune.key}' already exists. Overwriting.`
            );
        }
        this.runes.set(rune.key, rune);
        rune.initialize?.(this);
        return this;
    }

    addEdict(edict: Edict): this {
        if (this.edicts.has(edict.key)) {
            console.warn(
                `[Agent] Edict with key '${edict.key}' already exists. Overwriting.`
            );
        }
        this.edicts.set(edict.key, edict);
        edict.initialize?.(this);
        return this;
    }

    setGateway(gateway: Gateway): this {
        this.gateway = gateway;
        gateway.initialize?.(this);
        return this;
    }

    private getEdictsArray(): Edict[] {
        return Array.from(this.edicts.values());
    }

    private formatEdictsForPrompt(edictsToFormat: Edict[]): string {
        if (!edictsToFormat || edictsToFormat.length === 0) return "";
        return edictsToFormat
            .map(
                (edict) =>
                    `Tool: ${edict.key}\nDescription: ${
                        edict.description
                    }\nArguments (JSON Schema): ${JSON.stringify(
                        edict.argsSchema
                    )}\n---`
                // Make sure e.argsSchema is not undefined if you stringify it directly, or handle undefined
            )
            .join("\n\n"); // Added double newline for better separation
    }

    private async buildPrompts(
        userInput?: string,
        runesToUse?: Rune[]
    ): Promise<{ systemPrompt: string; userPrompt: string }> {
        if (!this.gateway) {
            throw new Error(
                "[Agent] Gateway not set. Cannot build prompts without tokenizer/context window."
            );
        }

        const modelContextWindow = this.gateway.getModelContextWindow();
        const targetTokens = this.config.targetTokens || 8000;
        const maxOutputTokens = this.config.maxOutputTokens || 1024;

        // Ensure targetTokens respects model limits, reserving space for output
        const effectiveMaxPromptTokens = Math.min(
            targetTokens,
            modelContextWindow - maxOutputTokens
        );

        let currentSystemTokens = 0;
        let currentUserPromptTokens = 0;

        const systemRuneContent: string[] = [];
        const userRuneContent: string[] = [];

        const activeRunes = runesToUse || Array.from(this.runes.values());
        const sortedRunes = activeRunes.sort((a, b) => a.order - b.order);

        for (const rune of sortedRunes) {
            const runeData = await rune.getData(); // Handles TTL
            const contentTokens = await this.gateway.tokenize(runeData.content);
            // runeData.tokenLength = contentTokens; // RuneData interface doesn't have tokenLength in your latest file.

            const fits =
                currentSystemTokens + currentUserPromptTokens + contentTokens <=
                effectiveMaxPromptTokens;

            if (fits) {
                if (runeData.type === "system") {
                    systemRuneContent.push(runeData.content);
                    currentSystemTokens += contentTokens;
                } else {
                    userRuneContent.push(runeData.content);
                    currentUserPromptTokens += contentTokens;
                }
            } else {
                console.warn(
                    `[Agent] Rune '${rune.key}' content (approx ${contentTokens} tokens) would exceed prompt token limit (${effectiveMaxPromptTokens}). Skipping or consider truncation.`
                );
                // TODO: Implement more sophisticated truncation if needed
                break;
            }
        }

        const edictMetadataString = this.formatEdictsForPrompt(
            this.getEdictsArray()
        );
        const edictMetadataTokens = await this.gateway.tokenize(
            edictMetadataString
        );

        let finalEdictMetadataForPrompt = "";
        if (
            edictMetadataString &&
            currentSystemTokens +
                currentUserPromptTokens +
                edictMetadataTokens <=
                effectiveMaxPromptTokens
        ) {
            finalEdictMetadataForPrompt = edictMetadataString;
            currentSystemTokens += edictMetadataTokens;
        } else if (edictMetadataString) {
            console.warn(
                `[Agent] Edict descriptions (approx ${edictMetadataTokens} tokens) would exceed prompt token limit. Descriptions might be omitted or truncated.`
            );
            // TODO: Truncate edictMetadataString or select fewer edicts
        }

        let userQueryString = "";
        if (userInput) {
            const userInputTokens = await this.gateway.tokenize(userInput);
            if (
                currentSystemTokens +
                    currentUserPromptTokens +
                    userInputTokens <=
                effectiveMaxPromptTokens
            ) {
                userQueryString = "\n\nHuman input:\n" + userInput; // Added formatting
                currentUserPromptTokens += userInputTokens;
            } else {
                console.warn(
                    `[Agent] User input (approx ${userInputTokens} tokens) would exceed prompt token limit. May be truncated or omitted.`
                );
                // TODO: Truncate userInput
            }
        }

        let systemPrompt = systemRuneContent.join("\n\n"); // Join with double newline
        if (finalEdictMetadataForPrompt) {
            systemPrompt +=
                "\n\n--- AVAILABLE TOOLS ---\n" + finalEdictMetadataForPrompt;
        }

        let userPrompt = userRuneContent.join("\n\n"); // Join with double newline
        if (userQueryString) {
            userPrompt += userQueryString;
        }
        if (
            !userPrompt &&
            systemRuneContent.length === 0 &&
            !finalEdictMetadataForPrompt
        ) {
            // if user prompt is empty and system is also minimal
            if (!userInput)
                throw new Error(
                    "[Agent] Cannot process with empty prompts and no user input."
                );
            userPrompt = userInput || ""; // Default to user input if all else is empty
        }

        console.log(
            `[Agent] Prompts built. System tokens: ~${currentSystemTokens}, User tokens: ~${currentUserPromptTokens}, Target: ${effectiveMaxPromptTokens}`
        );
        return { systemPrompt, userPrompt };
    }

    // Main interaction method
    async processTurn(
        userInput?: string,
        specificRunes?: Rune[]
    ): Promise<GatewayOutput> {
        if (!this.gateway) {
            throw new Error("[Agent] Gateway not set. Cannot process turn.");
        }
        if (this.runes.size === 0 && !userInput) {
            console.warn(
                "[Agent] No runes added and no user input provided. Processing might yield limited results."
            );
        }
        if (this.edicts.size === 0) {
            console.warn(
                "[Agent] No edicts added. Agent will not be able to perform actions."
            );
        }

        const { systemPrompt, userPrompt } = await this.buildPrompts(
            userInput,
            specificRunes
        );

        const llmParams: LLMCallParams = {
            maxOutputTokens: this.config.maxOutputTokens,
            temperature: this.config.temperature,
        };

        console.log("[Agent] Handing off to Gateway...");
        const gatewayOutput = await this.gateway.process(
            systemPrompt,
            userPrompt,
            this.getEdictsArray(),
            llmParams
        );

        console.log("[Agent] Received output from Gateway.");
        if (gatewayOutput.finalTextResponse) {
            console.log(
                "[Agent] Final Text Response:",
                gatewayOutput.finalTextResponse
            );
        }
        if (
            gatewayOutput.executedEdicts &&
            gatewayOutput.executedEdicts.length > 0
        ) {
            console.log(
                "[Agent] Executed Edicts:",
                gatewayOutput.executedEdicts
            );
        }

        return gatewayOutput;
    }
}
