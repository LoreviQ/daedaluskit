import winston from "winston";

export interface LogMetadata {
    agentName?: string;
    componentKey?: string;
}

const ANSI_COLORS = {
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    blue: "\x1b[34m",
    grey: "\x1b[90m",
    reset: "\x1b[0m",
};

const LEVEL_COLORS: Record<string, string> = {
    error: ANSI_COLORS.red,
    warn: ANSI_COLORS.yellow,
    info: ANSI_COLORS.green,
    http: ANSI_COLORS.magenta,
    verbose: ANSI_COLORS.cyan,
    debug: ANSI_COLORS.blue,
    silly: ANSI_COLORS.grey,
};

// Custom format to achieve [agentName] [componentKey] log text
const customFormat = winston.format.printf((info) => {
    const { level, agentName, componentKey, message } = info;

    const colorStart = LEVEL_COLORS[level] || "";
    const colorEnd = colorStart ? ANSI_COLORS.reset : "";

    // Capture all other arguments passed to the logger
    const splat = (info[Symbol.for("splat") as any] as any[]) || [];

    // Construct the uncolored prefix text
    const prefixParts = [];
    if (agentName) {
        prefixParts.push(`[${agentName}]`);
    }
    if (componentKey) {
        prefixParts.push(`[${componentKey}]`);
    }
    const uncoloredPrefix = prefixParts.join(" ");

    // Apply color to the entire prefix
    const finalPrefix = `${colorStart}${uncoloredPrefix}${colorEnd}`;

    // Collect all items that need to be logged.
    const itemsToLog: any[] = [];
    if (typeof message !== "undefined") {
        itemsToLog.push(message);
    }
    itemsToLog.push(...splat);

    // Empty log message and splat array
    if (itemsToLog.length === 0) {
        return uncoloredPrefix.trim() === "" ? "" : finalPrefix;
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
        return itemStr.split("\n").map((line) => {
            return uncoloredPrefix.trim() ? `${finalPrefix} ${line}` : line;
        });
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
