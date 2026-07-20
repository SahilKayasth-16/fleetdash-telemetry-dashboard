import winston from 'winston';
import { config } from '../config/index.js';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom log format for development environment console log
const devLogFormat = printf(({ level, message, timestamp, stack }) => {
  return `[${timestamp}] [${level}]: ${stack || message}`;
});

const formats = [errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })];

const transports = [];

if (config.isProduction) {
  // File transports for production
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(...formats, json()),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: combine(...formats, json()),
    }),
  );
  // Add console in production too
  transports.push(
    new winston.transports.Console({
      level: 'info',
      format: combine(...formats, json()),
    }),
  );
} else {
  // Colorful dev console output
  transports.push(
    new winston.transports.Console({
      level: 'debug',
      format: combine(colorize(), ...formats, devLogFormat),
    }),
  );
}

export const logger = winston.createLogger({
  level: config.isProduction ? 'info' : 'debug',
  transports,
  exitOnError: false,
});

export default logger;
