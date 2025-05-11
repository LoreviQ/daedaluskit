import { Logger } from "winston";

import {
    Rune,
    Edict,
    Catalyst,
    Gateway,
    GatewayOutput,
    LLMCallParams,
    Blueprint,
} from "./types";
import { createAgentLogger } from "./utils";

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

/**
 * The Agent class is the main interface for interacting with the system.
 * It manages runes, edicts, and catalysts, and handles the interaction with the LLM through a gateway.
 */
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

    /**
     * Adds a rune to the agent.
     * Runes gather information and provide context for the agent.
     * If a rune with the same key already exists, it will be overwritten.
     * @param rune The Rune instance to add.
     * @returns The agent instance for chaining.
     */
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

    /**
     * Adds multiple runes to the agent.
     * @param runes An array of Rune instances to add.
     * @returns The agent instance for chaining.
     */
    addRunes(runes: Rune[]): this {
        for (const rune of runes) {
            this.addRune(rune);
        }
        return this;
    }

    /**
     * Adds an edict to the agent.
     * Edicts are actions that the agent can perform.
     * If an edict with the same key already exists, it will be overwritten.
     * @param edict The Edict instance to add.
     * @returns The agent instance for chaining.
     */
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

    /**
     * Adds multiple edicts to the agent.
     * @param edicts An array of Edict instances to add.
     * @returns The agent instance for chaining.
     */
    addEdicts(edicts: Edict[]): this {
        for (const edict of edicts) {
            this.addEdict(edict);
        }
        return this;
    }

    /**
     * Adds a catalyst to the agent.
     * Catalysts trigger the agent execution.
     * If a catalyst with the same key already exists, it will be overwritten.
     * @param catalyst The Catalyst instance to add.
     * @returns The agent instance for chaining.
     */
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

    /**
     * Adds multiple catalysts to the agent.
     * @param catalysts An array of Catalyst instances to add.
     * @returns The agent instance for chaining.
     */
    addCatalysts(catalysts: Catalyst[]): this {
        for (const catalyst of catalysts) {
            this.addCatalyst(catalyst);
        }
        return this;
    }

    /**
     * Sets the gateway for the agent.
     * The gateway is responsible for processing the prompts and interacting with the LLM.
     * @param gateway The Gateway instance to set.
     * @returns The agent instance for chaining.
     */
    setGateway(gateway: Gateway): this {
        gateway.initialize(this);
        this.gateway = gateway;
        return this;
    }

    /**
     * Adds all components from a Blueprint to the agent.
     * Runes, Edicts, and Catalysts from the blueprint will be added,
     * and the Gateway from the blueprint will be set.
     * All components will be initialized as they are added to the agent.
     * @param blueprint The Blueprint instance to load.
     * @returns The agent instance for chaining.
     */
    addBlueprint(blueprint: Blueprint): this {
        this.logger.info(`Loading components from blueprint...`);

        if (blueprint.runes.length > 0) {
            this.addRunes(blueprint.runes as Rune[]); // Cast because blueprint.runes is ReadonlyArray
            this.logger.info(
                `Added ${blueprint.runes.length} rune(s) from blueprint.`
            );
        }
        if (blueprint.edicts.length > 0) {
            this.addEdicts(blueprint.edicts as Edict[]); // Cast
            this.logger.info(
                `Added ${blueprint.edicts.length} edict(s) from blueprint.`
            );
        }
        if (blueprint.catalysts.length > 0) {
            this.addCatalysts(blueprint.catalysts as Catalyst[]); // Cast
            this.logger.info(
                `Added ${blueprint.catalysts.length} catalyst(s) from blueprint.`
            );
        }
        if (blueprint.gateway) {
            this.setGateway(blueprint.gateway);
            this.logger.info(`Set gateway from blueprint.`);
        }
        this.logger.info("Blueprint components loaded successfully.");
        return this;
    }

    private formatEdictsForPrompt(): string {
        const edictsArray = Array.from(this.edicts.values());
        if (!edictsArray || edictsArray.length === 0) return "";
        return [
            "<available_tools>",
            edictsArray.map((e) => e.toPrompt()),
            "</available_tools>",
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

        /* Edict Metadeta might not be necessary? Test with other models
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
        */

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
