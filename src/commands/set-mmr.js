import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} from 'discord.js';
import { setPlayerMmr, searchPlayers, getRankEmoji } from '../utils/rlTracker.js';

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
    .setName('set-mmr')
    .setDescription('Setzt oder aktualisiert die manuelle MMR eines Spielers')
    .addStringOption((option) =>
      option
        .setName('player')
        .setDescription('Wähle oder tippe den Spielernamen')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('mmr')
        .setDescription('Manuelle MMR (z. B. 1540)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('rank')
        .setDescription('Rang überschreiben (optional, wird sonst automatisch aus MMR berechnet)')
        .setRequired(false)
        .addChoices(
          { name: 'Supersonic Legend', value: 'Supersonic Legend' },
          { name: 'Grand Champion', value: 'Grand Champion' },
          { name: 'Champion', value: 'Champion' },
          { name: 'Diamond', value: 'Diamond' },
          { name: 'Platin', value: 'Platin' },
          { name: 'Gold', value: 'Gold' }
        )
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const matches = searchPlayers(focused.value);
    await interaction.respond(
      matches.map((p) => {
        const mmrInfo = p.mmr ? ` (${p.mmr} MMR)` : '';
        return {
          name: `${p.name}${mmrInfo}`.slice(0, 100),
          value: p.name,
        };
      })
    );
  },

  async execute(interaction, client) {
    await interaction.deferReply();

    const playerName = interaction.options.getString('player');
    const mmr = interaction.options.getInteger('mmr');
    const rank = interaction.options.getString('rank');

    try {
      const { player, isNew } = setPlayerMmr(playerName, mmr, rank);
      const ping = await resolveMemberPing(interaction.guild, player.name);

      const rankBadge = getRankEmoji(player.rank);
      const rankPart = rankBadge ? `${rankBadge} ` : '';

      const title = isNew
        ? '## ✅ Neuer Spieler mit MMR angelegt'
        : '## 📈 Spieler-MMR erfolgreich aktualisiert';

      const lines = [
        `👤 **Spieler:** ${ping} (\`${player.name}\`)`,
        `📈 **Neue MMR:** **${player.mmr}**`,
        `🎖️ **Rang:** ${rankPart}**${player.rank}**`,
        `🔗 **Tracker:** [Profil öffnen](${player.tracker})`,
        '',
        '📌 *Die neue MMR wird ab sofort in `/create-team` verwendet!*',
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
    } catch (error) {
      await interaction.editReply({
        content: `❌ Fehler beim Setzen der MMR: ${error.message}`,
      });
    }
  },
};
