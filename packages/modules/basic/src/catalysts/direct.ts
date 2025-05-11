import { Catalyst } from "@daedaluskit/core";

export class Direct extends Catalyst {
    constructor() {
        super("DirectCatalyst");
    }

    async execute(data: string): Promise<void> {
        this.logger?.info(`Catalyst ${this.key} called with ${data}`);
        if (!this.agent) {
            this.logger?.error(`[${this.key}] Agent is not set.`);
            return;
        }
        try {
            await this.agent.execute(data);
        } catch (error) {
            this.logger?.error(
                `[${this.key}] Error during agent execution:`,
                error
            );
        }
    }
}
