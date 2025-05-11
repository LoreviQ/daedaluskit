import { Rune, RuneType } from "@daedaluskit/core";

export class CatalystContext extends Rune {
    constructor(
        key: string = "catalyst_context",
        order: number = 0,
        type: RuneType = "prompt",
        name: string = "Catalyst Context",
        description: string = "Contextual information from the Catalyst",
        ttlString: string = "0"
    ) {
        super(key, order, type, name, description, ttlString);
    }

    protected async gather(): Promise<string> {
        if (!this.agent) {
            console.error(
                `[${this.key}] Agent is not set. Cannot gather catalyst data.`
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
