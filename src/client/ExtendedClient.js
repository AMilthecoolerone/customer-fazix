import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { Agent } from 'undici';
import { loadCommands } from '../handlers/commandHandler.js';
import { loadEvents } from '../handlers/eventHandler.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

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

      this.on('warn', (warning) => logger.warn(`Discord Gateway warning: ${warning}`));

      this.on('shardReady', (id) => {
        logger.success(`[GATEWAY] Shard ${id} connected and ready!`);
      });

      this.on('shardDisconnect', (event, id) => {
        logger.warn(`[GATEWAY] Shard ${id} disconnected (code ${event.code}: ${event.reason || 'none'})`);
        if (event.code === 4014) {
          logger.error('CRITICAL: Code 4014 (Disallowed Intents). "Server Members Intent" must be enabled in Discord Developer Portal!');
        } else if (event.code === 4004) {
          logger.error('CRITICAL: Code 4004 (Authentication Failed). The provided DISCORD_TOKEN is invalid!');
        }
      });

      this.on('shardError', (error, id) => {
        logger.error(`[GATEWAY] Shard ${id} WebSocket error:`, error);
      });

      this.on('shardReconnecting', (id) => {
        logger.warn(`[GATEWAY] Shard ${id} reconnecting...`);
      });

      this.rest.on('rateLimited', (rateLimitData) => {
        logger.warn(
          `[REST RATE-LIMIT] Hit rate limit on ${rateLimitData.route}! Wait: ${rateLimitData.retryAfter}ms | Global: ${rateLimitData.global}`
        );
      });

      this.rest.on('invalidRequestWarning', (data) => {
        logger.warn(`[REST WARNING] Invalid request count: ${data.count}, remaining time: ${data.remainingTime}ms`);
      });

      if (process.env.DEBUG === 'true') {
        this.on('debug', (info) => logger.debug(info));
        this.rest.on('response', (request, response) => {
          const status = response?.status ?? 'unknown';
          logger.debug(`[REST] ${request.method.toUpperCase()} ${request.path} -> HTTP ${status}`);
        });
        this.rest.on('restDebug', (info) => logger.debug(`[REST] ${info}`));
      }

      // Pre-flight check: Test REST API & Gateway reachability directly
      logger.info('Running pre-flight connectivity check to Discord...');
      try {
        const probeRes = await fetch('https://discord.com/api/v10/gateway/bot', {
          headers: { Authorization: `Bot ${config.token}` },
        });

        if (probeRes.status === 429) {
          const retryAfter = probeRes.headers.get('retry-after') || 'unknown';
          const isGlobal = probeRes.headers.get('x-ratelimit-global') || 'false';
          logger.error(
            `CRITICAL: Host IP is RATE LIMITED by Discord (HTTP 429)!` +
            `\n  -> Retry after: ${retryAfter}s (Global: ${isGlobal})` +
            `\n  -> Cause: Shared host IP on Wispbyte exceeded Discord's gateway rate limit.` +
            `\n  -> Solution: Wait for the cooldown or contact Wispbyte support to assign a fresh IP / move to another node.`
          );
        } else if (probeRes.status === 401) {
          logger.error('CRITICAL: HTTP 401 Unauthorized. The DISCORD_TOKEN in .env is invalid!');
        } else if (probeRes.status === 403) {
          logger.error(
            'CRITICAL: HTTP 403 Forbidden. Cloudflare or Discord has blocked this host IP!' +
            '\n  -> Solution: Wispbyte shared IP is banned by Cloudflare. Request an IP change from Wispbyte.'
          );
        } else if (probeRes.ok) {
          const gwData = await probeRes.json();
          logger.info(
            `[PRE-FLIGHT] REST API OK. Gateway: ${gwData.url} | Shards: ${gwData.shards} | Session starts remaining: ${gwData.session_start_limit?.remaining}/${gwData.session_start_limit?.total}`
          );
        } else {
          logger.warn(`[PRE-FLIGHT] Unexpected status from Discord API: HTTP ${probeRes.status}`);
        }
      } catch (err) {
        logger.error(`[PRE-FLIGHT] Failed to reach Discord API: ${err.message}`);
        logger.error('  -> The container may lack outbound internet access or DNS resolution is failing.');
      }

      logger.info('Logging in to Discord...');

      const loginTimeout = setTimeout(() => {
        logger.warn(
          'Still waiting for Discord Gateway login... If this hangs on your host:' +
          '\n  1. The host IP might be rate-limited by Discord (429) or blocked by Cloudflare (1015).' +
          '\n  2. Make sure your local bot instance is stopped (2 instances conflict on gateway).' +
          '\n  3. Check if Privileged Gateway Intents (Server Members) are enabled in Discord Developer Portal.'
        );
      }, 20000);

      await this.login(config.token);
      clearTimeout(loginTimeout);
    } catch (error) {
      logger.error('Failed to start client:', error);
      process.exit(1);
    }
  }
}
