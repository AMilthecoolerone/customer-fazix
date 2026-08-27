import { Events } from 'discord.js';
import { logger } from '../../utils/logger.js';

export default {
  name: Events.Error,
  execute(_client, error) {
    logger.error('Discord client encountered an error:', error);
  },
};
