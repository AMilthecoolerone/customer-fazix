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
      logger.info('Logging in to Discord...');
      await this.login(config.token);
    } catch (error) {
      logger.error('Failed to start client:', error);
      process.exit(1);
    }
  }
}
