import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadCommands(client) {
  client.commands.clear();

  const commandsPath = path.resolve(__dirname, '..', 'commands');
  if (!fs.existsSync(commandsPath)) return;

  const entries = fs.readdirSync(commandsPath, { withFileTypes: true, recursive: true });
  let loaded = 0;

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (!entry.name.endsWith('.js')) continue;

    const fullPath = path.join(entry.parentPath || commandsPath, entry.name);

    try {
      const fileUrl = pathToFileURL(fullPath).href;
      const imported = await import(fileUrl);
      const command = imported.default || imported.command;

      if (!command?.data?.name || !command.execute) continue;

      client.commands.set(command.data.name, command);
      loaded++;
    } catch (error) {
      logger.error(`Failed to load command at ${fullPath}:`, error);
    }
  }

  logger.success(`Loaded ${loaded} command(s).`);
}
