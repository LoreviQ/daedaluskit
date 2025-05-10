import {
    Rune,
    RuneData,
    Edict,
    Gateway,
    GatewayOutput,
    LLMCallParams,
} from "./types";

export interface AgentConfig {
    targetTokens: number; // The Agent will aim for this number of tokens
    maxOutputTokens: number; // Maximum number of tokens for the LLM output
    temperature: number; // Temperature for the LLM
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
        return [
            "--- AVAILABLE TOOLS ---",
            edictsToFormat.map((e) => e.toPrompt()),
        ].join("\n\n");
    }

    private async buildPrompts(): Promise<{
        systemPrompt: string;
        userPrompt: string;
    }> {
        if (!this.gateway) {
            throw new Error(
                "[Agent] Gateway not set. Cannot build prompts without tokenizer/context window."
            );
        }

        const modelContextWindow = this.gateway.getModelContextWindow();
        // used later for more intelligent truncation
        const targetTokens =
            this.config.targetTokens || DEFAULT_AGENT_CONFIG.targetTokens;
        let currentSystemTokens = 0;
        let currentUserPromptTokens = 0;

        const systemRuneContent: string[] = [];
        const userRuneContent: string[] = [];

        const sortedRunes = Array.from(this.runes.values()).sort(
            (a, b) => a.order - b.order
        );

        for (const rune of sortedRunes) {
            const runeData = await rune.getData(); // Handles TTL
            runeData.tokens = await this.gateway.tokenize(runeData.content);

            if (
                currentSystemTokens +
                    currentUserPromptTokens +
                    runeData.tokens <=
                modelContextWindow
            ) {
                if (runeData.type === "system") {
                    systemRuneContent.push(runeData.content);
                    currentSystemTokens += runeData.tokens;
                } else {
                    userRuneContent.push(runeData.content);
                    currentUserPromptTokens += runeData.tokens;
                }
            } else {
                console.warn(
                    `[Agent] Rune '${rune.key}' content (approx ${runeData.tokens} tokens) would exceed prompt token limit (${modelContextWindow}). Skipping or consider truncation.`
                );
                break;
            }
        }

        const edictMetadataString = this.formatEdictsForPrompt(
            this.getEdictsArray()
        );
        const edictMetadataTokens = await this.gateway.tokenize(
            edictMetadataString
        );

        if (
            edictMetadataString &&
            currentSystemTokens +
                currentUserPromptTokens +
                edictMetadataTokens <=
                modelContextWindow
        ) {
            systemRuneContent.push(edictMetadataString);
            currentSystemTokens += edictMetadataTokens;
        } else if (edictMetadataString) {
            console.warn(
                `[Agent] Edict descriptions (approx ${edictMetadataTokens} tokens) would exceed prompt token limit. Descriptions might be omitted or truncated.`
            );
        }

        let systemPrompt = systemRuneContent.join("\n\n");
        let userPrompt = userRuneContent.join("\n\n");

        console.log(
            `[Agent] Prompts built. System tokens: ~${currentSystemTokens}, User tokens: ~${currentUserPromptTokens}`
        );
        return { systemPrompt, userPrompt };
    }

    // Main interaction method
    async execute(): Promise<GatewayOutput> {
        if (!this.gateway) {
            throw new Error("[Agent] Gateway not set. Cannot process turn.");
        }
        if (this.runes.size === 0) {
            console.warn(
                "[Agent] No runes added and no user input provided. Processing might yield limited results."
            );
        }
        if (this.edicts.size === 0) {
            console.warn(
                "[Agent] No edicts added. Agent will not be able to perform actions."
            );
        }

        const { systemPrompt, userPrompt } = await this.buildPrompts();

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
