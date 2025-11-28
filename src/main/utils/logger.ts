/**
 * 统一日志记录系统
 * 提供结构化、分级别的日志记录功能
 * Refactored to use Winston for robust logging
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as winston from 'winston';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

// Map internal LogLevel enum to Winston string levels
const levelMap: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error',
  [LogLevel.FATAL]: 'error', // Winston doesn't have FATAL by default, map to error
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  levelName: string;
  category: string;
  message: string;
  data?: Record<string, unknown>;
  error?: Error;
  module?: string;
  userId?: string;
  sessionId?: string;
  executionId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logDirectory?: string;
  maxFileSize?: number;
  maxFiles?: number;
  enableStructuredOutput: boolean;
  enableColors: boolean;
}

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private logger: winston.Logger;
  private sessionId: string;

  private constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: process.env.NODE_ENV !== 'development',
      logDirectory: config.logDirectory || path.join(os.homedir(), '.cryptocast', 'logs'),
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      enableStructuredOutput: true,
      enableColors: process.env.NODE_ENV === 'development',
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.ensureLogDirectory();

    // Create Winston logger
    this.logger = winston.createLogger({
      level: levelMap[this.config.level],
      defaultMeta: { sessionId: this.sessionId },
      transports: []
    });

    // Add Console Transport
    if (this.config.enableConsole) {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          this.config.enableColors ? winston.format.colorize() : winston.format.uncolorize(),
          winston.format.printf((info) => {
            const { timestamp, level, message, category, ...meta } = info;
            const cat = category ? `[${category}]` : '';
            const metaStr = Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
            return `${timestamp} ${level} ${cat}: ${message}${metaStr}`;
          })
        )
      }));
    }

    // Add File Transport
    if (this.config.enableFile) {
      const logFilename = path.join(this.config.logDirectory!, `cryptocast-${this.getDateString()}.log`);
      this.logger.add(new winston.transports.File({
        filename: logFilename,
        maxsize: this.config.maxFileSize,
        maxFiles: this.config.maxFiles,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      }));
    }
  }

  /**
   * 获取日志实例（单例模式）
   */
  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * 记录调试日志
   */
  debug(message: string, data?: Record<string, unknown>, category: string = 'GENERAL'): void {
    this.log(LogLevel.DEBUG, message, data, category);
  }

  /**
   * 记录信息日志
   */
  info(message: string, data?: Record<string, unknown>, category: string = 'GENERAL'): void {
    this.log(LogLevel.INFO, message, data, category);
  }

  /**
   * 记录警告日志
   */
  warn(message: string, data?: Record<string, unknown>, category: string = 'GENERAL'): void {
    this.log(LogLevel.WARN, message, data, category);
  }

  /**
   * 记录错误日志
   */
  error(message: string, error?: Error, data?: Record<string, unknown>, category: string = 'ERROR'): void {
    this.log(LogLevel.ERROR, message, data, category, error);
  }

  /**
   * 记录致命错误日志
   */
  fatal(message: string, error?: Error, data?: Record<string, unknown>, category: string = 'FATAL'): void {
    this.log(LogLevel.FATAL, message, data, category, error);
  }

  /**
   * 专用日志方法
   */
  blockchain(message: string, data?: Record<string, unknown>): void {
    this.info(message, data, 'BLOCKCHAIN');
  }

  campaign(message: string, data?: Record<string, unknown>): void {
    this.info(message, data, 'CAMPAIGN');
  }

  transaction(message: string, data?: Record<string, unknown>): void {
    this.info(message, data, 'TRANSACTION');
  }

  wallet(message: string, data?: Record<string, unknown>): void {
    this.info(message, data, 'WALLET');
  }

  network(message: string, data?: Record<string, unknown>): void {
    this.info(message, data, 'NETWORK');
  }

  database(message: string, data?: Record<string, unknown>): void {
    this.info(message, data, 'DATABASE');
  }

  performance(message: string, data?: Record<string, unknown>): void {
    this.info(message, data, 'PERFORMANCE');
  }

  security(message: string, data?: Record<string, unknown>): void {
    this.warn(message, data, 'SECURITY');
  }

  /**
   * 核心日志记录方法
   */
  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    category: string = 'GENERAL',
    error?: Error
  ): void {
    // Sanitize sensitive data
    const sanitizedData = data ? this.sanitizeData(data) : undefined;
    
    const meta: any = {
      category,
      data: sanitizedData,
    };

    if (error) {
      meta.error = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    }

    const winstonLevel = levelMap[level];
    this.logger.log(winstonLevel, message, meta);
  }

  /**
   * Sanitize sensitive data before logging
   */
  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = [
      'privatekey', 'private_key', 'privatekeybase64', 'private_key_base64',
      'secret', 'password', 'apikey', 'api_key', 'token', 'authorization',
      'walletprivatekey', 'wallet_private_key'
    ];

    const sanitize = (obj: unknown): unknown => {
      if (obj === null || obj === undefined) {
        return obj;
      }

      if (typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(item => sanitize(item));
      }

      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase().replace(/[_\s-]/g, '');
        if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    return sanitize(data) as Record<string, unknown>;
  }

  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private getDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.config.logDirectory!)) {
        fs.mkdirSync(this.config.logDirectory!, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * 创建子日志器（带模块前缀）
   */
  child(moduleName: string): {
    debug: (message: string, data?: Record<string, unknown>) => void;
    info: (message: string, data?: Record<string, unknown>) => void;
    warn: (message: string, data?: Record<string, unknown>) => void;
    error: (message: string, error?: Error, data?: Record<string, unknown>) => void;
    fatal: (message: string, error?: Error, data?: Record<string, unknown>) => void;
  } {
    // Return a wrapper that behaves like the parent but adds the module category/meta
    return {
      debug: (message: string, data?: Record<string, unknown>) => this.log(LogLevel.DEBUG, `[${moduleName}] ${message}`, data, moduleName),
      info: (message: string, data?: Record<string, unknown>) => this.log(LogLevel.INFO, `[${moduleName}] ${message}`, data, moduleName),
      warn: (message: string, data?: Record<string, unknown>) => this.log(LogLevel.WARN, `[${moduleName}] ${message}`, data, moduleName),
      error: (message: string, error?: Error, data?: Record<string, unknown>) => this.log(LogLevel.ERROR, `[${moduleName}] ${message}`, data, moduleName, error),
      fatal: (message: string, error?: Error, data?: Record<string, unknown>) => this.log(LogLevel.FATAL, `[${moduleName}] ${message}`, data, moduleName, error)
    };
  }

  getLogStats(): {
    sessionId: string;
    logDirectory: string;
    config: LoggerConfig;
  } {
    return {
      sessionId: this.sessionId,
      logDirectory: this.config.logDirectory!,
      config: this.config
    };
  }
}

// 导出全局日志实例
export const logger = Logger.getInstance();