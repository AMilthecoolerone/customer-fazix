import { Events, REST, Routes } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    if (!client.user) return;
    logger.success(`Logged in as ${client.user.tag}`);

    try {
      const rest = new REST({ version: '10' }).setToken(config.token);
      const commandsData = Array.from(client.commands.values()).map((c) => c.data.toJSON());

      if (config.guildId) {
        await rest.put(Routes.applicationGuildCommands(client.user.id, config.guildId), {
          body: commandsData,
        });
        logger.success(`Auto-registered ${commandsData.length} command(s) to guild ${config.guildId}!`);
      } else {
        await rest.put(Routes.applicationCommands(client.user.id), {
          body: commandsData,
        });
        logger.success(`Auto-registered ${commandsData.length} command(s) globally!`);
      }
    } catch (error) {
      logger.error('Failed to auto-register commands on ready:', error.message);
    }
  },
};
