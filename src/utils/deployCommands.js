import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { logger } from './logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deploy() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId) {
    logger.error('Missing credentials. Please provide DISCORD_TOKEN and CLIENT_ID in .env');
    process.exit(1);
  }

  const commandsPath = path.resolve(__dirname, '..', 'commands');
  const commandsData = [];
  const entries = fs.readdirSync(commandsPath, { withFileTypes: true, recursive: true });

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (!entry.name.endsWith('.js')) continue;

    const fullPath = path.join(entry.parentPath || commandsPath, entry.name);

    try {
      const fileUrl = pathToFileURL(fullPath).href;
      const imported = await import(fileUrl);
      const command = imported.default || imported.command;

      if (command?.data) {
        commandsData.push(command.data.toJSON());
      }
    } catch (error) {
      logger.error(`Error loading ${fullPath}:`, error);
    }
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    if (guildId) {
      logger.info(`Deploying ${commandsData.length} command(s) to guild ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commandsData,
      });
      logger.success(`Registered ${commandsData.length} command(s) to guild ${guildId}!`);
    } else {
      logger.info(`Deploying ${commandsData.length} command(s) globally...`);
      await rest.put(Routes.applicationCommands(clientId), {
        body: commandsData,
      });
      logger.success(`Registered ${commandsData.length} command(s) globally!`);
    }
  } catch (error) {
    if (error.code === 50001) {
      logger.error(
        `Missing Access: Bot is not on server ${guildId} or was invited without 'applications.commands' scope.`
      );
      logger.info('Attempting fallback global deployment...');
      try {
        await rest.put(Routes.applicationCommands(clientId), { body: commandsData });
        logger.success(`Registered ${commandsData.length} command(s) globally as fallback!`);
      } catch (globalErr) {
        logger.error('Global deploy also failed:', globalErr);
      }
    } else {
      logger.error('Failed to deploy commands:', error);
    }
  }
}

deploy();
