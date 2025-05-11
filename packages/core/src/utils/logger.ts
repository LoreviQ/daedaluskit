import winston from "winston";

export interface LogMetadata {
    agentName?: string;
    componentKey?: string;
}

// Custom format to achieve [agentName] [componentKey] log text
const customFormat = winston.format.printf(
    ({ message, agentName, componentKey }) => {
        let logs = [];
        if (agentName) {
            logs.push(`[${agentName}]`);
        }
        if (componentKey) {
            logs.push(`[${componentKey}]`);
        }
        if (message) {
            logs.push(message);
        }
        return logs.join(" ");
    }
);

export function createAgentLogger(
    agentName: string,
    logLevel: string = "info"
): winston.Logger {
    return winston.createLogger({
        level: logLevel,
        format: winston.format.combine(customFormat),
        defaultMeta: { agentName },
        transports: [new winston.transports.Console()],
    });
}
