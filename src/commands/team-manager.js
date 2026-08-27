import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import {
  loadPlayers,
  parseTrackerInput,
  fetchPlayerStats,
  getRankEmoji,
} from '../utils/rlTracker.js';

const TEAM_EMOJIS = {
  'Team OGs': '<:OGs:1539014735675265144>',
  'Team Orbit': '<:Orbit:1534937900758601739>',
  'Team Nova': '<:Nova:1536110649174790245>',
  'Team Main': '<:Main:1540098795264680058>',
};

const playerChoices = loadPlayers()
  .slice(0, 25)
  .map((p) => ({ name: p.name, value: p.name }));

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
    .setName('create-team')
    .setDescription('Erstellt dein esports team mit Live-MMR')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('team-name')
        .setDescription('Wähle das Team')
        .setRequired(true)
        .addChoices(
          { name: 'Team OGs', value: 'Team OGs' },
          { name: 'Team Orbit', value: 'Team Orbit' },
          { name: 'Team Nova', value: 'Team Nova' },
          { name: 'Team Main', value: 'Team Main' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('main-spieler1')
        .setDescription('Captain')
        .setRequired(true)
        .addChoices(...playerChoices)
    )
    .addStringOption((option) =>
      option
        .setName('main-spieler2')
        .setDescription('Spieler 2')
        .setRequired(true)
        .addChoices(...playerChoices)
    )
    .addStringOption((option) =>
      option
        .setName('main-spieler3')
        .setDescription('Spieler 3')
        .setRequired(true)
        .addChoices(...playerChoices)
    )
    .addStringOption((option) =>
      option
        .setName('sub-1')
        .setDescription('Sub 1 (optional)')
        .setRequired(false)
        .addChoices(...playerChoices)
    )
    .addStringOption((option) =>
      option
        .setName('sub-2')
        .setDescription('Sub 2 (optional)')
        .setRequired(false)
        .addChoices(...playerChoices)
    )
    .addStringOption((option) =>
      option.setName('coach').setDescription('Der Coach (optional)').setRequired(false)
    ),

  async execute(interaction, client) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: 'Nur Administratoren dürfen diesen Befehl verwenden.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const teamName = interaction.options.getString('team-name');
    const p1 = interaction.options.getString('main-spieler1');
    const p2 = interaction.options.getString('main-spieler2');
    const p3 = interaction.options.getString('main-spieler3');
    const sub1 = interaction.options.getString('sub-1');
    const sub2 = interaction.options.getString('sub-2');
    const coach = interaction.options.getString('coach');

    const mainInputs = [
      { role: 'captain', input: p1 },
      { role: 'member', input: p2 },
      { role: 'member', input: p3 },
    ];

    const subInputs = [];
    if (sub1) subInputs.push({ role: 'sub', input: sub1 });
    if (sub2) subInputs.push({ role: 'sub', input: sub2 });

    const mainPlayers = await Promise.all(
      mainInputs.map(async (item) => {
        const parsed = parseTrackerInput(item.input);
        const stats = await fetchPlayerStats(parsed.platform, parsed.identifier, parsed.matchedPlayer);
        return { ...item, ...stats, matchedPlayer: parsed.matchedPlayer };
      })
    );

    const subPlayers = await Promise.all(
      subInputs.map(async (item) => {
        const parsed = parseTrackerInput(item.input);
        const stats = await fetchPlayerStats(parsed.platform, parsed.identifier, parsed.matchedPlayer);
        return { ...item, ...stats, matchedPlayer: parsed.matchedPlayer };
      })
    );

    const totalMmr = mainPlayers.reduce((acc, p) => acc + (Number(p.mmr) || 0), 0);
    const avgMmr = mainPlayers.length > 0 ? Number((totalMmr / mainPlayers.length).toFixed(2)) : 0;

    const formatPlayerLine = async (p, isCaptain = false) => {
      const icon = isCaptain ? '👑' : '👤';
      const rankBadge = getRankEmoji(p.rank);
      const rankPart = rankBadge ? `${rankBadge} ` : '';
      const ping = await resolveMemberPing(interaction.guild, p.matchedPlayer?.name || p.name);
      return `${icon} ❯ ${rankPart}${ping}`;
    };

    const playerLines = [
      await formatPlayerLine(mainPlayers[0], true),
      await formatPlayerLine(mainPlayers[1], false),
      await formatPlayerLine(mainPlayers[2], false),
    ];

    for (const sub of subPlayers) {
      playerLines.push(await formatPlayerLine(sub, false));
    }

    if (coach) {
      const coachPing = await resolveMemberPing(interaction.guild, coach);
      playerLines.push(`📋 ❯ 🧢 Coach: ${coachPing}`);
    }

    const teamEmoji = TEAM_EMOJIS[teamName] || '🏆';

    const container = new ContainerBuilder()
      .setAccentColor(0xe91e63)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${teamEmoji} ${teamName}       📈 ${avgMmr}`)
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(playerLines.join('\n'))
      );

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
