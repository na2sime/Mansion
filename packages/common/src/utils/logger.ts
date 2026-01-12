export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LoggerConfig {
  serviceName: string;
  level?: LogLevel;
}

export class Logger {
  private serviceName: string;
  private level: LogLevel;

  constructor(config: LoggerConfig) {
    this.serviceName = config.serviceName;
    this.level = config.level || LogLevel.INFO;
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      ...(meta && { meta }),
    };

    const formattedMessage = `[${timestamp}] [${level}] [${this.serviceName}] ${message}`;

    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage, meta || '');
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, meta || '');
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, meta || '');
        break;
      case LogLevel.DEBUG:
        console.debug(formattedMessage, meta || '');
        break;
    }
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log(LogLevel.DEBUG, message, meta);
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log(LogLevel.INFO, message, meta);
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log(LogLevel.WARN, message, meta);
    }
  }

  error(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.log(LogLevel.ERROR, message, meta);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
}
