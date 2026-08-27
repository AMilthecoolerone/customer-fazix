import dns from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';
import { ExtendedClient } from './client/ExtendedClient.js';
import { logger } from './utils/logger.js';

// Prioritize IPv4 over IPv6 to prevent connection hangs on Linux/VPS hosting environments
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Force Undici (the HTTP engine used by discord.js / fetch) to use IPv4.
// Node's dns.setDefaultResultOrder does NOT apply to undici by default.
// In Docker containers (e.g. Pterodactyl / Wispbyte), undici tries IPv6 first and hangs
// because the container has dual-stack DNS but no outbound IPv6 route.
setGlobalDispatcher(
  new Agent({
    connect: {
      family: 4,
    },
  })
);

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
