export type LogFields = Record<string, unknown>;

export interface StructuredLogger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

export function createStructuredLogger(service: string): StructuredLogger {
  const write = (
    level: "info" | "warn" | "error",
    event: string,
    fields: LogFields = {},
  ) => {
    const line = JSON.stringify({
      level,
      time: new Date().toISOString(),
      service,
      event,
      ...fields,
    });

    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  };

  return {
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}
