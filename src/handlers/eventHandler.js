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

export async function loadEvents(client) {
  const eventsPath = path.resolve(__dirname, '..', 'events');
  const files = getJsFiles(eventsPath);
  let loaded = 0;

  for (const fullPath of files) {
    try {
      const fileUrl = pathToFileURL(fullPath).href;
      const imported = await import(fileUrl);
      const event = imported.default || imported.event;

      if (!event?.name || !event.execute) continue;

      if (event.once) {
        client.once(event.name, (...args) => event.execute(client, ...args));
      } else {
        client.on(event.name, (...args) => event.execute(client, ...args));
      }

      loaded++;
    } catch (error) {
      logger.error(`Failed to load event at ${fullPath}:`, error);
    }
  }

  logger.success(`Loaded ${loaded} event(s).`);
}
