import { Events } from 'discord.js';
import { logger } from '../../utils/logger.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    if (!client.user) return;
    logger.success(`Logged in as ${client.user.tag}`);
  },
};

