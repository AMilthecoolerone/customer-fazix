import { Collection, Events } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export default {
  name: Events.InteractionCreate,
  async execute(client, interaction) {
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command && command.autocomplete) {
        try {
          await command.autocomplete(interaction, client);
        } catch (error) {
          logger.error(`Error in autocomplete /${interaction.commandName}:`, error);
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    const { cooldowns } = client;
    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownDuration = (command.cooldown ?? config.defaultCooldown) * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownDuration;
      if (now < expirationTime) {
        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
        await interaction.reply({
          content: `Please wait ${timeLeft}s before using \`/${command.data.name}\` again.`,
          ephemeral: true,
        });
        return;
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownDuration);

    try {
      await command.execute(interaction, client);
    } catch (error) {
      logger.error(`Error executing /${interaction.commandName}:`, error);
      const content = 'There was an error while executing this command.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, ephemeral: true });
      } else {
        await interaction.reply({ content, ephemeral: true });
      }
    }
  },
};
