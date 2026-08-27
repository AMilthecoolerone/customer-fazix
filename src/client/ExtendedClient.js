import { Client, Collection, GatewayIntentBits } from 'discord.js';
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

      if (process.env.DEBUG === 'true') {
        this.on('debug', (info) => logger.debug(info));
      }

      logger.info('Logging in to Discord...');

      const loginTimeout = setTimeout(() => {
        logger.warn(
          'Still waiting for Discord Gateway login... If this hangs on your host:' +
          '\n  1. Make sure your local bot instance is stopped (2 instances conflict on gateway).' +
          '\n  2. Check if Privileged Gateway Intents (Server Members) are enabled in Discord Developer Portal.' +
          '\n  3. Set DEBUG=true in .env on your host to inspect the exact gateway handshake.'
        );
      }, 10000);

      await this.login(config.token);
      clearTimeout(loginTimeout);
    } catch (error) {
      logger.error('Failed to start client:', error);
      process.exit(1);
    }
  }
}
