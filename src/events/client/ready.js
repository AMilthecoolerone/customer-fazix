import { Events } from 'discord.js';
import { logger } from '../../utils/logger.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    if (!client.user) return;
    logger.success(`Logged in as ${client.user.tag}`);

    // Pre-cache guild members to ensure instantaneous mention resolution and autocomplete
    try {
      for (const guild of client.guilds.cache.values()) {
        await guild.members.fetch().catch(() => {});
      }
    } catch {}
  },
};

