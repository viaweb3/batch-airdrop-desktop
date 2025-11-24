/**
 * 统一日志记录系统
 * 提供结构化、分级别的日志记录功能
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  levelName: string;
  category: string;
  message: string;
  data?: any;
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
  private logFilePath: string;
  private sessionId: string;

  private constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: process.env.NODE_ENV !== 'development', // 生产环境默认启用文件日志
      logDirectory: config.logDirectory || path.join(os.homedir(), 'cryptocast', 'logs'),
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      enableStructuredOutput: true,
      enableColors: process.env.NODE_ENV === 'development',
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.logFilePath = path.join(this.config.logDirectory || '', `cryptocast-${this.getDateString()}.log`);

    // 确保日志目录存在
    this.ensureLogDirectory();

    // 设置日志轮转
    if (this.config.enableFile) {
      this.setupLogRotation();
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
  debug(message: string, data?: any, category: string = 'GENERAL'): void {
    this.log(LogLevel.DEBUG, message, data, category);
  }

  /**
   * 记录信息日志
   */
  info(message: string, data?: any, category: string = 'GENERAL'): void {
    this.log(LogLevel.INFO, message, data, category);
  }

  /**
   * 记录警告日志
   */
  warn(message: string, data?: any, category: string = 'GENERAL'): void {
    this.log(LogLevel.WARN, message, data, category);
  }

  /**
   * 记录错误日志
   */
  error(message: string, error?: Error, data?: any, category: string = 'ERROR'): void {
    this.log(LogLevel.ERROR, message, data, category, error);
  }

  /**
   * 记录致命错误日志
   */
  fatal(message: string, error?: Error, data?: any, category: string = 'FATAL'): void {
    this.log(LogLevel.FATAL, message, data, category, error);
  }

  /**
   * 专用日志方法
   */
  // 区块链相关日志
  blockchain(message: string, data?: any): void {
    this.info(message, data, 'BLOCKCHAIN');
  }

  // 活动相关日志
  campaign(message: string, data?: any): void {
    this.info(message, data, 'CAMPAIGN');
  }

  // 交易相关日志
  transaction(message: string, data?: any): void {
    this.info(message, data, 'TRANSACTION');
  }

  // 钱包相关日志
  wallet(message: string, data?: any): void {
    this.info(message, data, 'WALLET');
  }

  // 网络相关日志
  network(message: string, data?: any): void {
    this.info(message, data, 'NETWORK');
  }

  // 数据库相关日志
  database(message: string, data?: any): void {
    this.info(message, data, 'DATABASE');
  }

  // 性能相关日志
  performance(message: string, data?: any): void {
    this.info(message, data, 'PERFORMANCE');
  }

  // 安全相关日志
  security(message: string, data?: any): void {
    this.warn(message, data, 'SECURITY');
  }

  /**
   * 核心日志记录方法
   */
  private log(
    level: LogLevel,
    message: string,
    data?: any,
    category: string = 'GENERAL',
    error?: Error
  ): void {
    if (level < this.config.level) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      levelName: LogLevel[level],
      category,
      message,
      data,
      error,
      sessionId: this.sessionId,
      module: this.getCallingModule()
    };

    // 输出到控制台
    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }

    // 输出到文件
    if (this.config.enableFile) {
      this.logToFile(logEntry);
    }
  }

  /**
   * 输出到控制台
   */
  private logToConsole(entry: LogEntry): void {
    const { timestamp, levelName, category, message, error } = entry;
    const colorCode = this.getColorCode(entry.level);
    const resetCode = '\x1b[0m';

    let logMessage: string;

    if (this.config.enableStructuredOutput) {
      // 结构化输出
      logMessage = `${colorCode}[${timestamp}] ${levelName} [${category}]${resetCode} ${message}`;

      if (entry.data) {
        logMessage += `\n${colorCode}  Data:${resetCode} ${JSON.stringify(entry.data, null, 2)}`;
      }

      if (error) {
        logMessage += `\n${colorCode}  Error:${resetCode} ${error.stack || error.message}`;
      }
    } else {
      // 简单输出
      logMessage = `${colorCode}[${timestamp}] ${levelName} [${category}]${resetCode} ${message}`;
    }

    console.log(logMessage);
  }

  /**
   * 输出到文件
   */
  private async logToFile(entry: LogEntry): Promise<void> {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      await fs.promises.appendFile(this.logFilePath, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * 获取颜色代码
   */
  private getColorCode(level: LogLevel): string {
    if (!this.config.enableColors) {
      return '';
    }

    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // 青色
      [LogLevel.INFO]: '\x1b[32m',  // 绿色
      [LogLevel.WARN]: '\x1b[33m',  // 黄色
      [LogLevel.ERROR]: '\x1b[31m', // 红色
      [LogLevel.FATAL]: '\x1b[35m'  // 紫色
    };

    return colors[level] || '';
  }

  /**
   * 获取调用模块
   */
  private getCallingModule(): string {
    const stack = new Error().stack;
    if (!stack) return 'unknown';

    const lines = stack.split('\n');
    // 找到调用logger的栈帧
    const loggerLineIndex = lines.findIndex(line => line.includes('Logger.'));
    if (loggerLineIndex !== -1 && loggerLineIndex + 1 < lines.length) {
      const callerLine = lines[loggerLineIndex + 1];
      const match = callerLine.match(/at\s+(.+?)\s+\(/);
      return match ? match[1] : 'unknown';
    }

    return 'unknown';
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 获取日期字符串
   */
  private getDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * 确保日志目录存在
   */
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
   * 设置日志轮转
   */
  private setupLogRotation(): void {
    // 简单的日志轮转检查
    setInterval(() => {
      this.checkAndRotateLogs();
    }, 60 * 60 * 1000); // 每小时检查一次
  }

  /**
   * 检查并轮转日志
   */
  private async checkAndRotateLogs(): Promise<void> {
    try {
      const stats = await fs.promises.stat(this.logFilePath);

      if (stats.size > this.config.maxFileSize!) {
        await this.rotateLogFile();
      }
    } catch (error) {
      // 文件不存在或其他错误，忽略
    }
  }

  /**
   * 轮转日志文件
   */
  private async rotateLogFile(): Promise<void> {
    try {
      const today = this.getDateString();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivePath = path.join(
        this.config.logDirectory!,
        `cryptocast-${today}-${timestamp}.log`
      );

      // 重命名当前日志文件
      await fs.promises.rename(this.logFilePath, archivePath);

      // 清理旧日志文件
      await this.cleanupOldLogs();

      this.info('Log file rotated', { archivePath }, 'SYSTEM');
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * 清理旧日志文件
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.config.logDirectory!);
      const logFiles = files
        .filter(file => file.startsWith('cryptocast-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.config.logDirectory!, file),
          time: fs.statSync(path.join(this.config.logDirectory!, file)).mtime
        }))
        .sort((a, b) => b.time.getTime() - a.time.getTime());

      // 保留最新的文件，删除多余的
      if (logFiles.length > this.config.maxFiles!) {
        const filesToDelete = logFiles.slice(this.config.maxFiles!);

        for (const file of filesToDelete) {
          await fs.promises.unlink(file.path);
        }

        this.info('Cleaned up old log files', {
          deleted: filesToDelete.length,
          remaining: logFiles.length - filesToDelete.length
        }, 'SYSTEM');
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  /**
   * 创建子日志器（带模块前缀）
   */
  child(moduleName: string): {
    debug: (message: string, data?: any) => void;
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, error?: Error, data?: any) => void;
    fatal: (message: string, error?: Error, data?: any) => void;
  } {
    return {
      debug: (message: string, data?: any) => this.debug(`[${moduleName}] ${message}`, data, moduleName),
      info: (message: string, data?: any) => this.info(`[${moduleName}] ${message}`, data, moduleName),
      warn: (message: string, data?: any) => this.warn(`[${moduleName}] ${message}`, data, moduleName),
      error: (message: string, error?: Error, data?: any) => this.error(`[${moduleName}] ${message}`, error, data, moduleName),
      fatal: (message: string, error?: Error, data?: any) => this.fatal(`[${moduleName}] ${message}`, error, data, moduleName)
    };
  }

  /**
   * 获取日志统计
   */
  getLogStats(): {
    sessionId: string;
    logDirectory: string;
    currentLogFile: string;
    config: LoggerConfig;
  } {
    return {
      sessionId: this.sessionId,
      logDirectory: this.config.logDirectory!,
      currentLogFile: this.logFilePath,
      config: this.config
    };
  }
}

// 导出全局日志实例
export const logger = Logger.getInstance();