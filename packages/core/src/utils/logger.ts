import winston from "winston";

export interface LogMetadata {
    agentName?: string;
    componentKey?: string;
}

// Custom format to achieve [timestamp] [loglevel] [agentName] [componentKey] log text
const customFormat = winston.format.printf(
    ({ level, message, timestamp, agentName, componentKey }) => {
        let log = `${timestamp} [${level.toUpperCase()}]`;

        if (agentName) {
            log += ` [${agentName}]`;
        }
        if (componentKey) {
            log += ` [${componentKey}]`;
        }
        log += ` ${message}`;
        return log;
    }
);

export function createAgentLogger(
    agentName: string,
    logLevel: string = "info"
): winston.Logger {
    return winston.createLogger({
        level: logLevel,
        format: winston.format.combine(
            winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
            winston.format.colorize(), // Adds colors to the level
            winston.format.errors({ stack: true }), // Handles error objects, adds stack trace
            customFormat
        ),
        defaultMeta: { agentName },
        transports: [new winston.transports.Console()],
    });
}
