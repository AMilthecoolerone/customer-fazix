import dns from 'node:dns';
import { ExtendedClient } from './client/ExtendedClient.js';
import { logger } from './utils/logger.js';

// Prioritize IPv4 over IPv6 to prevent connection hangs on Linux/VPS hosting environments
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

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
