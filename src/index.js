import dns from 'node:dns';
import net from 'node:net';
import { Agent, setGlobalDispatcher } from 'undici';
import { ExtendedClient } from './client/ExtendedClient.js';
import { logger } from './utils/logger.js';

// Monkey-patch dns.lookup to force IPv4 (family: 4) across all Node core networking (net, tls, https, ws).
// In Docker/Pterodactyl/Wispbyte containers without external IPv6 routing, any IPv6 attempt hangs indefinitely.
const originalLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = { family: 4 };
  } else if (typeof options === 'number') {
    options = { family: 4 };
  } else {
    options = { ...options, family: 4 };
  }
  return originalLookup.call(dns, hostname, options, callback);
};

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Disable Node 19/20 Happy Eyeballs autoSelectFamily which attempts broken IPv6 parallel handshakes on Linux
if (net.setDefaultAutoSelectFamily) {
  net.setDefaultAutoSelectFamily(false);
}

// Force Undici (the HTTP engine used by discord.js / fetch) to use IPv4.
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
