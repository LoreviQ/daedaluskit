import winston from "winston";

export interface LogMetadata {
    agentName?: string;
    componentKey?: string;
}

// Custom format to achieve [agentName] [componentKey] log text
const customFormat = winston.format.printf((info) => {
    // Destructure known metadata keys and the message from the info object
    const { agentName, componentKey, message: rawMessage } = info;

    // Capture all other arguments passed to the logger
    const splat = (info[Symbol.for("splat") as any] as any[]) || [];

    // Construct the prefix string (e.g., "[agentName] [componentKey]")
    const prefixParts = [];
    if (agentName) {
        prefixParts.push(`[${agentName}]`);
    }
    if (componentKey) {
        prefixParts.push(`[${componentKey}]`);
    }
    const prefix = prefixParts.join(" ");

    // Collect all items that need to be logged.
    const itemsToLog: any[] = [];
    if (typeof rawMessage !== "undefined") {
        itemsToLog.push(rawMessage);
    }
    itemsToLog.push(...splat);

    // Empty log message and splat array
    if (itemsToLog.length === 0) {
        return prefix.trim() === "" ? "" : prefix;
    }

    // Format each item. If an item is a multi-line string, each line gets the prefix.
    const logLines = itemsToLog.flatMap((item) => {
        let itemStr: string;
        if (typeof item === "string") {
            itemStr = item;
        } else if (item instanceof Error) {
            // For Error objects, include the stack trace if available for better debugging.
            itemStr = item.stack || item.message;
        } else if (typeof item === "object" && item !== null) {
            // For other objects, pretty-print JSON for readability.
            itemStr = JSON.stringify(item, null, 2);
        } else {
            // Convert to string.
            itemStr = String(item);
        }
        return itemStr
            .split("\n")
            .map((line) => (prefix ? `${prefix} ${line}` : line));
    });

    return logLines.join("\n");
});

export function createAgentLogger(
    agentName: string,
    logLevel: string = "info"
): winston.Logger {
    return winston.createLogger({
        level: logLevel,
        format: customFormat,
        defaultMeta: { agentName },
        transports: [new winston.transports.Console()],
    });
}
