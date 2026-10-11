import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} from 'discord.js';
import { setWebsiteBanner, clearWebsiteBanner } from '../utils/fazixApi.js';
import { config } from '../config/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription('Verwaltet das obere Ankündigungsbanner auf fazix.gg')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Setzt oder aktualisiert den Text im oberen Banner')
        .addStringOption((option) =>
          option
            .setName('text')
            .setDescription('Der Text, der oben über die Website läuft')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('link')
            .setDescription('Optionaler Link (z. B. https://twitch.tv/fazix_esports oder #esports)')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('clear')
        .setDescription('Deaktiviert das obere Banner auf der Website')
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'set') {
        const text = interaction.options.getString('text');
        const link = interaction.options.getString('link') || '#news';

        const res = await setWebsiteBanner({ text, link });

        if (!res.ok || !res.data?.success) {
          await interaction.editReply({
            content: `❌ Fehler beim Aktualisieren des Banners: ${res.data?.error || 'Serverfehler'}`,
          });
          return;
        }

        const websiteUrl = config.fazixApiUrl || 'https://fazix-esport.xyz';
        const lines = [
          `📢 **Text:** *"${text}"*`,
          `🔗 **Ziel:** \`${link}\``,
          '',
          `🌐 **Website:** [fazix-esport.xyz öffnen](${websiteUrl})`,
          '📌 *Das Banner läuft ab sofort live über alle Seiten der Website!*',
        ];

        const container = new ContainerBuilder()
          .setAccentColor(0xff5900) // FAZIX Brand Orange
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## 🚀 Top-Banner Live auf FAZIX.GG')
          )
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(lines.join('\n'))
          );

        await interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        });
      } else if (subcommand === 'clear') {
        const res = await clearWebsiteBanner();

        if (!res.ok || !res.data?.success) {
          await interaction.editReply({
            content: `❌ Fehler beim Ausblenden des Banners: ${res.data?.error || 'Serverfehler'}`,
          });
          return;
        }

        const lines = [
          'Das obere Ankündigungsbanner wurde deaktiviert und von der Website entfernt.',
          '',
          '🌐 **Website:** [fazix.gg öffnen](http://localhost:3000)',
          '💡 *Mit `/banner set` kannst du jederzeit ein neues Banner aktivieren.*',
        ];

        const container = new ContainerBuilder()
          .setAccentColor(0x888894)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## ⏹️ Top-Banner Deaktiviert')
          )
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
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
        content: `❌ Ein Fehler ist aufgetreten: ${error.message}`,
      });
    }
  },
};
