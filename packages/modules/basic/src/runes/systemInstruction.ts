import { Rune } from "@daedaluskit/core";

export class SystemPrefix extends Rune {
    private systemPrefix: string;
    constructor(systemPrefix: string) {
        super(
            "system_prefix",
            Number.NEGATIVE_INFINITY,
            "system",
            "System Prefix",
            "The system prefix for the agent.",
            "0" // Revalidation doesn't matter, data is static anyway
        );
        this.systemPrefix = systemPrefix;
    }

    protected async gather(): Promise<string> {
        return this.systemPrefix;
    }
}

export class SystemSuffix extends Rune {
    private systemSuffix: string;
    constructor(systemSuffix: string) {
        super(
            "system_suffix",
            Number.POSITIVE_INFINITY,
            "system",
            "System Suffix",
            "The system suffix for the agent.",
            "0" // Revalidation doesn't matter, data is static anyway
        );
        this.systemSuffix = systemSuffix;
    }

    protected async gather(): Promise<string> {
        return this.systemSuffix;
    }
}
