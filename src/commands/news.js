import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} from 'discord.js';
import { createWebsiteNews } from '../utils/fazixApi.js';
import { calculateReadingTime } from '../utils/readingTime.js';
import { config } from '../config/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Veröffentlicht einen News-Artikel im Latest News Bereich auf fazix.gg')
    .addStringOption((option) =>
      option
        .setName('title')
        .setDescription('Überschrift der News (z. B. NEW ROSTER SIGNING)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('summary')
        .setDescription('Kurze Zusammenfassung für die Vorschau-Karte')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('content')
        .setDescription('Ausführlicher Text des Artikels (optional)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('badge')
        .setDescription('Kategorie-Tag (z. B. ROSTER, RLCS, TACTICS, OFFICIAL)')
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName('show_on_banner')
        .setDescription('Diesen Titel auch sofort oben im Banner anzeigen? (True/False)')
        .setRequired(false)
    )
    .addAttachmentOption((option) =>
      option
        .setName('image')
        .setDescription('Eigenes Bild für den Artikel hochladen (optional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const title = interaction.options.getString('title');
    const summary = interaction.options.getString('summary');
    const content = interaction.options.getString('content');
    const badge = (interaction.options.getString('badge') || 'NEWS').toUpperCase();
    const showOnBanner = interaction.options.getBoolean('show_on_banner') || false;
    const imageAttachment = interaction.options.getAttachment('image');

    const imageUrl = imageAttachment?.url || undefined;

    try {
      const fullText = `${title} ${summary} ${content || ''}`;
      const readTime = await calculateReadingTime(fullText);

      const res = await createWebsiteNews({
        title,
        summary,
        content: content || summary,
        badge,
        image: imageUrl,
        readTime,
        showOnBanner,
      });

      if (!res.ok || !res.data?.success) {
        await interaction.editReply({
          content: `❌ Fehler beim Veröffentlichen: ${res.data?.error || 'Serverfehler'}`,
        });
        return;
      }

      const publishedArticle = res.data.article;
      const displayReadTime = publishedArticle?.readTime || readTime;
      const websiteUrl = config.fazixApiUrl || 'https://fazix-esport.xyz';

      const lines = [
        `📰 **Titel:** **${publishedArticle?.title || title}**`,
        `🏷️ **Kategorie:** \`[${badge}]\``,
        `⏱️ **Lesezeit:** \`${displayReadTime}\``,
        `📝 **Zusammenfassung:** *${summary}*`,
        showOnBanner ? '📌 **Top-Banner:** *Wurde ebenfalls mit dieser News aktualisiert!*' : '',
        '',
        `🌐 **Website:** [fazix-esport.xyz/#news öffnen](${websiteUrl}/#news)`,
        '✨ *Der Artikel erscheint ab sofort im Bereich „LATEST NEWS“ auf der Startseite!*',
      ].filter(Boolean);

      const container = new ContainerBuilder()
        .setAccentColor(0xff5900) // FAZIX Brand Orange
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('## ✅ News-Artikel veröffentlicht!')
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(lines.join('\n'))
        );

      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      await interaction.editReply({
        content: `❌ Ein Fehler ist aufgetreten: ${error.message}`,
      });
    }
  },
};
