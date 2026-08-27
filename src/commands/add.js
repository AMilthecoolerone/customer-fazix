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
import { addOrUpdateTeam } from '../utils/teams.js';
import { addOrUpdatePlayer } from '../utils/rlTracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        .addAttachmentOption((option) =>
          option
            .setName('logo')
            .setDescription('Team-Logo (PNG oder Bilddatei)')
            .setRequired(true)
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
        const logoAttachment = interaction.options.getAttachment('logo');

        if (!logoAttachment || !logoAttachment.contentType?.startsWith('image/')) {
          await interaction.editReply({
            content: '❌ Bitte lade eine gültige Bilddatei (z. B. PNG) für das Team-Logo hoch.',
          });
          return;
        }

        // Download the logo image buffer
        const response = await fetch(logoAttachment.url);
        if (!response.ok) {
          throw new Error('Konnte die Bilddatei des Logos nicht herunterladen.');
        }
        const imageBuffer = Buffer.from(await response.arrayBuffer());

        // Save a local copy in src/data/logos
        const logosDir = path.resolve(__dirname, '..', 'data', 'logos');
        if (!fs.existsSync(logosDir)) {
          fs.mkdirSync(logosDir, { recursive: true });
        }
        const fileExt = path.extname(logoAttachment.name || '') || '.png';
        const safeFileName = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + fileExt;
        const localLogoPath = path.join(logosDir, safeFileName);
        fs.writeFileSync(localLogoPath, imageBuffer);

        // Sanitize emoji name for Discord (2-32 characters, alphanumeric and underscores)
        let cleanEmojiName = name
          .replace(/^team\s+/i, '')
          .trim()
          .replace(/[^a-zA-Z0-9_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '');

        if (cleanEmojiName.length < 2) {
          cleanEmojiName = `team_${cleanEmojiName || 'logo'}`;
        }
        cleanEmojiName = cleanEmojiName.slice(0, 32);

        let emojiString = '🏆';
        let logoUrl = logoAttachment.url;

        // Create or update the server emoji with the uploaded logo
        if (interaction.guild) {
          try {
            const existingEmoji = interaction.guild.emojis.cache.find(
              (e) => e.name.toLowerCase() === cleanEmojiName.toLowerCase()
            );
            if (existingEmoji) {
              try {
                await existingEmoji.delete('Team-Logo wird aktualisiert');
              } catch {}
            }

            const createdEmoji = await interaction.guild.emojis.create({
              attachment: imageBuffer,
              name: cleanEmojiName,
              reason: `Team-Logo für ${name}`,
            });

            emojiString = createdEmoji.toString();
            logoUrl = createdEmoji.url;
          } catch (emojiErr) {
            console.error('Konnte Guild-Emoji nicht erstellen:', emojiErr.message);
          }
        }

        const { team, isNew } = addOrUpdateTeam(name, emojiString, logoUrl);

        const title = isNew
          ? '## ✅ Neues Team hinzugefügt'
          : '## 🔄 Team aktualisiert';

        const lines = [
          `**Name:** ${team.emoji} **${team.name}**`,
          `**Logo / Emoji:** ${team.emoji}`,
          '',
          '📌 *Das Team ist ab sofort in `/create-team` mit dem neuen Logo verfügbar!*',
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
