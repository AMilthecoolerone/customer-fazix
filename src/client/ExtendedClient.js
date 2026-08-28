import { createRequire } from 'node:module';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { WebSocketManager as WSWebSocketManagerESM } from '@discordjs/ws';
import { Agent } from 'undici';
import { loadCommands } from '../handlers/commandHandler.js';
import { loadEvents } from '../handlers/eventHandler.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const require = createRequire(import.meta.url);
const { WebSocketManager: WSWebSocketManagerCJS } = require('@discordjs/ws');

let gatewayRateLimited = false;

const fallbackGatewayData = {
  url: 'wss://gateway.discord.gg',
  shards: 1,
  session_start_limit: {
    total: 1000,
    remaining: 999,
    reset_after: 0,
    max_concurrency: 1,
  },
};

// Patch both CJS (used by discord.js internally) and ESM instances of WebSocketManager
for (const WSManager of [WSWebSocketManagerCJS, WSWebSocketManagerESM]) {
  if (!WSManager || !WSManager.prototype) continue;
  const originalFetchGatewayInformation = WSManager.prototype.fetchGatewayInformation;

  WSManager.prototype.fetchGatewayInformation = async function (force = false) {
    if (this.gatewayInformation && !force) {
      return this.gatewayInformation.data;
    }

    if (gatewayRateLimited) {
      logger.warn(
        '[GATEWAY] Host IP is rate-limited on /gateway/bot. Bypassing and connecting directly to wss://gateway.discord.gg...'
      );
      this.gatewayInformation = { data: fallbackGatewayData, expiresAt: Date.now() + 86400000 };
      return fallbackGatewayData;
    }

    try {
      const fetchPromise = originalFetchGatewayInformation.call(this, force);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('GATEWAY_BOT_TIMEOUT')), 3000)
      );
      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (error) {
      logger.warn(
        `[GATEWAY] /gateway/bot rate-limited or timed out (${error.name || error.message}). Activating direct gateway fallback...`
      );
      this.gatewayInformation = { data: fallbackGatewayData, expiresAt: Date.now() + 86400000 };
      return fallbackGatewayData;
    }
  };
}

export class ExtendedClient extends Client {
  commands = new Collection();
  cooldowns = new Collection();

  constructor(options = {}) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildEmojisAndStickers,
      ],
      rest: {
        rejectOnRateLimit: ['/gateway/bot'],
        agent: new Agent({
          connect: {
            family: 4,
          },
        }),
      },
      ...options,
    });
  }

  async start() {
    if (!config.token) {
      logger.error('Cannot start bot: DISCORD_TOKEN is missing in .env');
      process.exit(1);
    }

    try {
      logger.info('Starting bot...');
      await loadCommands(this);
      await loadEvents(this);

      this.on('shardReady', (id) => {
        logger.success(`[GATEWAY] Shard ${id} connected and ready!`);
      });

      this.on('shardDisconnect', (event, id) => {
        if (event.code === 4014) {
          logger.error('CRITICAL: Code 4014 (Disallowed Intents). "Server Members Intent" must be enabled in Discord Developer Portal!');
        } else if (event.code === 4004) {
          logger.error('CRITICAL: Code 4004 (Authentication Failed). The provided DISCORD_TOKEN is invalid!');
        }
      });

      this.on('shardError', (error, id) => {
        logger.error(`[GATEWAY] Shard ${id} WebSocket error:`, error);
      });

      if (process.env.DEBUG === 'true') {
        this.on('debug', (info) => logger.debug(info));
        this.rest.on('response', (request, response) => {
          const status = response?.status ?? 'unknown';
          logger.debug(`[REST] ${request.method.toUpperCase()} ${request.path} -> HTTP ${status}`);
        });
        this.rest.on('restDebug', (info) => logger.debug(`[REST] ${info}`));
      }

      await this.login(config.token);
    } catch (error) {
      logger.error('Failed to start client:', error);
      process.exit(1);
    }
  }
}
