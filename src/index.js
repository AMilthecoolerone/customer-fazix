import dns from 'node:dns';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
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

// Also patch dns.promises.lookup
if (dns.promises && dns.promises.lookup) {
  const originalPromisesLookup = dns.promises.lookup;
  dns.promises.lookup = async function (hostname, options) {
    if (typeof options === 'number') {
      options = { family: 4 };
    } else if (typeof options === 'object' && options !== null) {
      options = { ...options, family: 4 };
    } else {
      options = { family: 4 };
    }
    return originalPromisesLookup.call(dns.promises, hostname, options);
  };
}

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Disable Node 19/20 Happy Eyeballs autoSelectFamily which attempts broken IPv6 parallel handshakes on Linux
if (net.setDefaultAutoSelectFamily) {
  net.setDefaultAutoSelectFamily(false);
}

// Force global HTTP/HTTPS agents to use IPv4. This affects `ws` package.
if (http.globalAgent) http.globalAgent.options.family = 4;
if (https.globalAgent) https.globalAgent.options.family = 4;

// Monkey-patch tls.connect and net.connect just to be absolutely sure for WS
const originalTlsConnect = tls.connect;
tls.connect = function (...args) {
  let options = args.find((arg) => typeof arg === 'object' && arg !== null) || {};
  options.family = 4;
  if (args.length > 0 && typeof args[0] === 'object') {
    args[0].family = 4;
  }
  return originalTlsConnect.apply(this, args);
};

const originalNetConnect = net.connect;
net.connect = function (...args) {
  let options = args.find((arg) => typeof arg === 'object' && arg !== null) || {};
  options.family = 4;
  if (args.length > 0 && typeof args[0] === 'object') {
    args[0].family = 4;
  }
  return originalNetConnect.apply(this, args);
};

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
