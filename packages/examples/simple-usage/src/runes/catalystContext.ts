import { Rune, Agent, RuneType } from "@daedaluskit/core";

export interface CatalystContextStringRuneConfig {
    promptPrefix?: string;
}

const defaultConfig: CatalystContextStringRuneConfig = {};

export class CatalystContextStringRune extends Rune<CatalystContextStringRuneConfig> {
    private agent?: Agent;

    constructor(
        key: string = "catalyst_context",
        order: number = 0,
        type: RuneType = "prompt",
        name: string = "Catalyst Context",
        description: string = "Contextual information from the Catalyst",
        ttlString: string = "0",
        config: CatalystContextStringRuneConfig = defaultConfig
    ) {
        super(key, order, type, name, description, ttlString, config);
    }

    public async initialize(agent: Agent): Promise<void> {
        this.agent = agent;
        if (super.initialize) {
            await this.initialize(agent);
        }
    }

    protected async gather(): Promise<string> {
        if (!this.agent) {
            console.warn(
                `[${this.key}] Agent instance not available. Returning empty string.`
            );
            return "";
        }

        const catalystData = this.agent.currentCatalystData;

        if (!catalystData) {
            console.warn(
                `[${this.key}] No catalyst data available. Returning empty string.`
            );
            return "";
        }
        if (typeof catalystData != "string") {
            console.error(
                `[${this.key}] Catalyst data is not a string. Returning empty string.`
            );
            return "";
        }
        return (this.config?.promptPrefix || "") + catalystData;
    }
}
