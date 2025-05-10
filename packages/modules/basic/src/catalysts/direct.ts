import { Catalyst } from "@daedaluskit/core";

export interface CatalystConfig {}

export class DirectCatalyst extends Catalyst<CatalystConfig> {
    readonly key = "DirectCatalyst";

    async execute(data: string): Promise<void> {
        console.log(`Catalyst ${this.key} called with ${data}`);
        try {
            await this.agent.execute(data);
        } catch (error) {
            console.error(`[${this.key}] Error during agent execution:`, error);
        }
    }
}
