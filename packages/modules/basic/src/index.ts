import { getCoreVersion } from "@daedaluskit/core";

export function getBasicUtility(): string {
    console.log("Core version used by basic:", getCoreVersion());
    return "Basic Initialized";
}

import * as catalysts from "./catalysts";
import * as edicts from "./edicts";
import * as gateways from "./gateways";
import * as runes from "./runes";

export const Catalysts = catalysts;
export const Edicts = edicts;
export const Gateways = gateways;
export const Runes = runes;
