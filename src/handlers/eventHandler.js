import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadEvents(client) {
  const eventsPath = path.resolve(__dirname, '..', 'events');
  if (!fs.existsSync(eventsPath)) return;

  const entries = fs.readdirSync(eventsPath, { withFileTypes: true, recursive: true });
  let loaded = 0;

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (!entry.name.endsWith('.js')) continue;

    const fullPath = path.join(entry.parentPath || eventsPath, entry.name);

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
