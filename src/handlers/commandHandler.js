import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getJsFiles(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function loadCommands(client) {
  client.commands.clear();

  let commandsPath = path.resolve(__dirname, '..', 'commands');
  if (!fs.existsSync(commandsPath)) {
    const altPath = path.resolve(__dirname, '..', 'Commands');
    if (fs.existsSync(altPath)) commandsPath = altPath;
  }

  const files = getJsFiles(commandsPath);
  let loaded = 0;

  for (const fullPath of files) {
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
