import { Logger } from "winston";

import {
    Rune,
    Edict,
    Catalyst,
    Gateway,
    GatewayOutput,
    LLMCallParams,
} from "./types";
import { createAgentLogger } from "./utils/logger";

export interface AgentConfig {
    name: string; // Name of the agent
    targetTokens: number; // The Agent will aim for this number of tokens
    maxOutputTokens: number; // Maximum number of tokens for the LLM output
    temperature: number; // Temperature for the LLM
    logLevel: string; // Log level for the agent
}

const DEFAULT_AGENT_CONFIG: AgentConfig = {
    name: "Agent",
    targetTokens: 10000,
    maxOutputTokens: 1024,
    temperature: 0.7,
    logLevel: "info",
};

export class Agent {
    private runes: Map<string, Rune> = new Map();
    private edicts: Map<string, Edict> = new Map();
    private catalysts: Map<string, Catalyst> = new Map();
    private gateway?: Gateway;
    public config: AgentConfig;
    public currentCatalystData: any = null;
    public logger: Logger;

    constructor(config?: Partial<AgentConfig>) {
        this.config = {
            ...DEFAULT_AGENT_CONFIG,
            ...config,
        };
        this.logger = createAgentLogger(this.config.name, this.config.logLevel);
    }

    addRune(rune: Rune): this {
        if (this.runes.has(rune.key)) {
            this.logger.warn(
                `Rune with key '${rune.key}' already exists. Overwriting.`
            );
        }
        rune.initialize(this);
        this.runes.set(rune.key, rune);
        return this;
    }

    addRunes(runes: Rune[]): this {
        for (const rune of runes) {
            this.addRune(rune);
        }
        return this;
    }

    addEdict(edict: Edict): this {
        if (this.edicts.has(edict.key)) {
            this.logger.warn(
                `Edict with key '${edict.key}' already exists. Overwriting.`
            );
        }
        edict.initialize(this);
        this.edicts.set(edict.key, edict);
        return this;
    }

    addEdicts(edicts: Edict[]): this {
        for (const edict of edicts) {
            this.addEdict(edict);
        }
        return this;
    }

    addCatalyst(catalyst: Catalyst): this {
        if (this.catalysts.has(catalyst.key)) {
            this.logger.warn(
                `Catalyst with key '${catalyst.key}' already exists. Overwriting.`
            );
        }
        catalyst.initialize(this);
        this.catalysts.set(catalyst.key, catalyst);
        return this;
    }

    addCatalysts(catalysts: Catalyst[]): this {
        for (const catalyst of catalysts) {
            this.addCatalyst(catalyst);
        }
        return this;
    }

    setGateway(gateway: Gateway): this {
        gateway.initialize(this);
        this.gateway = gateway;
        return this;
    }

    private formatEdictsForPrompt(): string {
        const edictsArray = Array.from(this.edicts.values());
        if (!edictsArray || edictsArray.length === 0) return "";
        return [
            "--- AVAILABLE TOOLS ---",
            edictsArray.map((e) => e.toPrompt()),
        ].join("\n\n");
    }

    private async buildPrompts(): Promise<{
        systemPrompt: string;
        userPrompt: string;
    }> {
        if (!this.gateway) {
            throw new Error(
                "Gateway not set. Cannot build prompts without tokenizer/context window."
            );
        }

        const modelContextWindow = this.gateway.contextWindow;
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
                this.logger.warn(
                    `Rune '${rune.key}' content (approx ${runeData.tokens} tokens) would exceed prompt token limit (${modelContextWindow}). Skipping or consider truncation.`
                );
                break;
            }
        }

        const edictMetadataString = this.formatEdictsForPrompt();
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
            this.logger.warn(
                `Edict descriptions (approx ${edictMetadataTokens} tokens) would exceed prompt token limit. Descriptions might be omitted or truncated.`
            );
        }

        let systemPrompt = systemRuneContent.join("\n\n");
        let userPrompt = userRuneContent.join("\n\n");

        this.logger.info(
            `Prompts built. System tokens: ~${currentSystemTokens}, User tokens: ~${currentUserPromptTokens}`
        );
        return { systemPrompt, userPrompt };
    }

    // Main interaction method
    async execute(catalystData: any): Promise<GatewayOutput> {
        this.currentCatalystData = catalystData;
        if (!this.gateway) {
            throw new Error("Gateway not set. Cannot process turn.");
        }
        if (this.runes.size === 0) {
            this.logger.warn(
                "No runes added and no user input provided. Processing might yield limited results."
            );
        }
        if (this.edicts.size === 0) {
            this.logger.warn(
                "No edicts added. Agent will not be able to perform actions."
            );
        }

        const { systemPrompt, userPrompt } = await this.buildPrompts();

        const llmParams: LLMCallParams = {
            maxOutputTokens: this.config.maxOutputTokens,
            temperature: this.config.temperature,
        };

        this.logger.info("Handing off to Gateway...");
        this.logger.debug(
            "----------System Prompt----------",
            systemPrompt,
            "----------User Prompt----------",
            userPrompt,
            "----------LLM Params----------",
            llmParams
        );
        const gatewayOutput = await this.gateway.process(
            systemPrompt,
            userPrompt,
            this.edicts,
            llmParams
        );

        this.logger.info("Received output from Gateway.");
        if (gatewayOutput.finalTextResponse) {
            this.logger.info(
                "Final Text Response:",
                gatewayOutput.finalTextResponse
            );
        }
        if (
            gatewayOutput.executedEdicts &&
            gatewayOutput.executedEdicts.length > 0
        ) {
            this.logger.info("Executed Edicts:", gatewayOutput.executedEdicts);
        }

        this.currentCatalystData = null;
        return gatewayOutput;
    }
}
