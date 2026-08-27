import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} from 'discord.js';
import { deleteTeam, searchTeams } from '../utils/teams.js';
import { deletePlayer, searchPlayers } from '../utils/rlTracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Löscht Teams oder Spieler aus der Datenbank')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('team')
        .setDescription('Löscht ein Team aus der Datenbank')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Wähle das zu löschende Team')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('player')
        .setDescription('Löscht einen Spieler aus der Datenbank')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Wähle den zu löschenden Spieler')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const focused = interaction.options.getFocused(true);

    if (subcommand === 'team') {
      const matches = searchTeams(focused.value);
      await interaction.respond(
        matches.map((t) => ({ name: t.name, value: t.name }))
      );
    } else if (subcommand === 'player') {
      const matches = searchPlayers(focused.value);
      await interaction.respond(
        matches.map((p) => ({ name: p.name, value: p.name }))
      );
    }
  },

  async execute(interaction, client) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'team') {
        const name = interaction.options.getString('name');
        const { success, team } = deleteTeam(name);

        if (!success) {
          await interaction.editReply({
            content: `❌ Das Team **"${name}"** wurde nicht in der Datenbank gefunden.`,
          });
          return;
        }

        // Delete custom guild emoji if present
        if (interaction.guild && team.emoji?.startsWith('<:')) {
          const match = team.emoji.match(/<:([a-zA-Z0-9_]+):(\d+)>/);
          if (match) {
            const emojiId = match[2];
            const guildEmoji = interaction.guild.emojis.cache.get(emojiId);
            if (guildEmoji) {
              try {
                await guildEmoji.delete('Team wurde gelöscht');
              } catch (emojiErr) {
                console.error('Konnte Guild-Emoji nicht löschen:', emojiErr.message);
              }
            }
          }
        }

        // Clean up local logo file if exists
        const logosDir = path.resolve(__dirname, '..', 'data', 'logos');
        const fileExts = ['.png', '.jpg', '.jpeg', '.webp'];
        for (const ext of fileExts) {
          const safeFileName = team.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + ext;
          const localPath = path.join(logosDir, safeFileName);
          if (fs.existsSync(localPath)) {
            try {
              fs.unlinkSync(localPath);
            } catch {}
          }
        }

        const lines = [
          `**Gelöschtes Team:** ${team.emoji} **${team.name}**`,
          '',
          '📌 *Das Team wurde aus der Datenbank und aus `/create-team` entfernt.*',
        ];

        const container = new ContainerBuilder()
          .setAccentColor(0xff3366)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## 🗑️ Team erfolgreich gelöscht')
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(lines.join('\n'))
          );

        await interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        });
      } else if (subcommand === 'player') {
        const name = interaction.options.getString('name');
        const { success, player } = deletePlayer(name);

        if (!success) {
          await interaction.editReply({
            content: `❌ Der Spieler **"${name}"** wurde nicht in der Datenbank gefunden.`,
          });
          return;
        }

        const lines = [
          `**Gelöschter Spieler:** \`${player.name}\``,
          player.tracker ? `🔗 **Tracker:** [Profil öffnen](${player.tracker})` : '',
          '',
          '📌 *Der Spieler wurde aus der Spielerliste und Autovervollständigung entfernt.*',
        ].filter(Boolean);

        const container = new ContainerBuilder()
          .setAccentColor(0xff3366)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## 🗑️ Spieler erfolgreich gelöscht')
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(lines.join('\n'))
          );

        await interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    } catch (error) {
      await interaction.editReply({
        content: `❌ Fehler beim Löschen: ${error.message}`,
      });
    }
  },
};
