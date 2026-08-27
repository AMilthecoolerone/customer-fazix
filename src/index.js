import { ExtendedClient } from './client/ExtendedClient.js';
import { logger } from './utils/logger.js';

const client = new ExtendedClient();

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

const handleShutdown = () => {
  client.destroy();
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

client.start();
