import { getCoreVersion } from "@daedaluskit/core";

export function getBasicUtility(): string {
    console.log("Core version used by basic:", getCoreVersion());
    return "Basic Initialized";
}
