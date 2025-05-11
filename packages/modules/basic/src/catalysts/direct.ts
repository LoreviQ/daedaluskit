import { Catalyst } from "@daedaluskit/core";

export class Direct extends Catalyst {
    constructor() {
        super("DirectCatalyst");
    }

    async execute(data: string): Promise<void> {
        console.log(`Catalyst ${this.key} called with ${data}`);
        if (!this.agent) {
            console.error(`[${this.key}] Agent is not set.`);
            return;
        }
        try {
            await this.agent.execute(data);
        } catch (error) {
            console.error(`[${this.key}] Error during agent execution:`, error);
        }
    }
}
