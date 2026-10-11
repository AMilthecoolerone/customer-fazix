import dotenv from 'dotenv';
dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  guildId: process.env.GUILD_ID || undefined,
  defaultCooldown: 3,
  fazixApiUrl: (process.env.FAZIX_API_URL || 'https://fazix-esport.xyz').replace(/\/+$/, ''),
  fazixApiSecret: process.env.FAZIX_DISCORD_BOT_SECRET || 'fazix_dev_discord_bot_secret_2026',
  apiverveApiKey: process.env.APIVERVE_API_KEY || '',
};
