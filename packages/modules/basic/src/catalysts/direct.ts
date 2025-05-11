import { Catalyst } from "@daedaluskit/core";

export class DirectCatalyst extends Catalyst {
    constructor(agent: any, config?: any) {
        super("DirectCatalyst", agent, config);
    }

    async execute(data: string): Promise<void> {
        console.log(`Catalyst ${this.key} called with ${data}`);
        try {
            await this.agent.execute(data);
        } catch (error) {
            console.error(`[${this.key}] Error during agent execution:`, error);
        }
    }
}
