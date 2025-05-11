import { Rune } from "./rune";
import { Edict } from "./edict";
import { Catalyst } from "./catalyst";
import { Gateway } from "./gateway";

/**
 * Configuration for creating a Blueprint.
 * Allows specifying runes, edicts, catalysts, and a gateway that define
 * a reusable agent setup.
 */
export interface BlueprintConfig {
    runes?: Rune[];
    edicts?: Edict[];
    catalysts?: Catalyst[];
    gateway?: Gateway;
}

/**
 * A Blueprint is a pre-defined collection of Runes, Edicts, Catalysts, and a Gateway.
 * It serves as a template that can be easily added to an Agent to quickly configure it.
 * The components within a blueprint are not initialized until they are added to an Agent.
 */
export class Blueprint {
    public readonly runes: ReadonlyArray<Rune>;
    public readonly edicts: ReadonlyArray<Edict>;
    public readonly catalysts: ReadonlyArray<Catalyst>;
    public readonly gateway?: Gateway;

    constructor(config: BlueprintConfig = {}) {
        this.runes = config.runes || [];
        this.edicts = config.edicts || [];
        this.catalysts = config.catalysts || [];
        this.gateway = config.gateway;
    }
}
