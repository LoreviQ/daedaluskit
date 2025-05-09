import { getCoreVersion } from "@deadaluskit/core";

export function getBasicUtility(): string {
  console.log("Core version used by basic:", getCoreVersion());
  return "Basic Initialized";
}
