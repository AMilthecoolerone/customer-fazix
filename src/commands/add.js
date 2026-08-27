import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} from 'discord.js';
import { addOrUpdateTeam } from '../utils/teams.js';
import { addOrUpdatePlayer } from '../utils/rlTracker.js';

async function resolveMemberPing(guild, username) {
  if (!guild || !username) return `@${username}`;
  if (username.startsWith('<@')) return username;

  const clean = username.trim().toLowerCase();

  let member = guild.members.cache.find(
    (m) =>
      m.user.username.toLowerCase() === clean ||
      m.displayName.toLowerCase() === clean ||
      m.user.tag.toLowerCase() === clean
  );

  if (!member) {
    try {
      const fetched = await guild.members.fetch({ query: clean, limit: 1 });
      member = fetched.first();
    } catch {}
  }

  if (member) {
    return `<@${member.id}>`;
  }

  return `@${username}`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Fügt Teams oder Spieler zur Datenbank hinzu')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('team')
        .setDescription('Fügt ein neues Team hinzu oder aktualisiert ein bestehendes')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Name des Teams (z. B. Team Pulse)')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('emoji')
            .setDescription('Team-Emoji oder Icon (z. B. <:tag:id> oder 🏆)')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('player')
        .setDescription('Fügt einen neuen Spieler hinzu oder aktualisiert einen bestehenden')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Name oder Discord-Tag des Spielers')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('tracker')
            .setDescription('Rocket League Tracker URL oder Identifier (z. B. epic:username)')
            .setRequired(false)
        )
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'team') {
        const name = interaction.options.getString('name');
        const emoji = interaction.options.getString('emoji') || '🏆';

        const { team, isNew } = addOrUpdateTeam(name, emoji);

        const title = isNew
          ? '## ✅ Neues Team hinzugefügt'
          : '## 🔄 Team aktualisiert';

        const lines = [
          `**Name:** ${team.emoji} ${team.name}`,
          `**Emoji:** \`${team.emoji}\``,
          '',
          '📌 *Das Team ist ab sofort in `/create-team` auswählbar!*',
        ];

        const container = new ContainerBuilder()
          .setAccentColor(0x00ff88)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(title)
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
        const tracker = interaction.options.getString('tracker');

        const { player, isNew } = addOrUpdatePlayer(name, tracker);
        const ping = await resolveMemberPing(interaction.guild, player.name);

        const title = isNew
          ? '## ✅ Neuer Spieler hinzugefügt'
          : '## 🔄 Spieler aktualisiert';

        const lines = [
          `👤 **Spieler:** ${ping} (\`${player.name}\`)`,
          `🔗 **Tracker:** [Profil öffnen](${player.tracker})`,
          '',
          '📌 *Der Spieler steht ab sofort in der Autovervollständigung für `/create-team` bereit!*',
        ];

        const container = new ContainerBuilder()
          .setAccentColor(0x00d4ff)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(title)
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
        content: `❌ Fehler beim Speichern: ${error.message}`,
      });
    }
  },
};
