import { Rune, Agent, RuneType } from "@daedaluskit/core";

export class CatalystContextStringRune extends Rune {
    private agent: Agent;

    constructor(
        key: string = "catalyst_context",
        order: number = 0,
        type: RuneType = "prompt",
        name: string = "Catalyst Context",
        description: string = "Contextual information from the Catalyst",
        ttlString: string = "0",
        agent: Agent
    ) {
        super(key, order, type, name, description, ttlString);
        this.agent = agent;
    }

    protected async gather(): Promise<string> {
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
