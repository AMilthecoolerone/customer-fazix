import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEAMS_PATH = path.resolve(__dirname, '..', 'data', 'teams.json');

const DEFAULT_TEAMS = [
  { name: 'Team OGs', emoji: '<:OGs:1542597015370731551>' },
  { name: 'Team Orbit', emoji: '<:Orbit:1542597142038847568>' },
  { name: 'Team Nova', emoji: '<:Nova:1542597071507423232>' },
  { name: 'Team Main', emoji: '<:Main:1542596895610900551>' },
];

export function loadTeams() {
  if (!fs.existsSync(TEAMS_PATH)) {
    return [...DEFAULT_TEAMS];
  }
  try {
    const raw = JSON.parse(fs.readFileSync(TEAMS_PATH, 'utf8'));
    if (Array.isArray(raw)) {
      return raw.map((item) => ({
        name: typeof item === 'string' ? item : item.name || '',
        emoji: typeof item === 'object' && item.emoji ? item.emoji : '🏆',
        logo: typeof item === 'object' && item.logo ? item.logo : '',
      })).filter((t) => t.name.length > 0);
    }
    return [...DEFAULT_TEAMS];
  } catch {
    return [...DEFAULT_TEAMS];
  }
}

export function saveTeams(teams) {
  const dir = path.dirname(TEAMS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(TEAMS_PATH, JSON.stringify(teams, null, 2), 'utf8');
}

export function addOrUpdateTeam(name, emoji = '', logo = '') {
  const cleanName = (name || '').trim();
  if (!cleanName) throw new Error('Team-Name darf nicht leer sein.');

  const cleanEmoji = (emoji || '').trim() || '🏆';
  const teams = loadTeams();
  const index = teams.findIndex((t) => t.name.toLowerCase() === cleanName.toLowerCase());

  let isNew = false;
  let team;

  if (index >= 0) {
    if (cleanEmoji) teams[index].emoji = cleanEmoji;
    if (logo) teams[index].logo = logo;
    team = teams[index];
  } else {
    team = { name: cleanName, emoji: cleanEmoji, logo: logo || '' };
    teams.push(team);
    isNew = true;
  }

  saveTeams(teams);
  return { team, isNew };
}

export function deleteTeam(name) {
  const cleanName = (name || '').trim().toLowerCase();
  const teams = loadTeams();
  const index = teams.findIndex((t) => t.name.toLowerCase() === cleanName);
  if (index === -1) {
    return { success: false, team: null };
  }
  const [deletedTeam] = teams.splice(index, 1);
  saveTeams(teams);
  return { success: true, team: deletedTeam };
}

export function searchTeams(query = '') {
  const q = query.trim().toLowerCase();
  const teams = loadTeams();
  if (!q) return teams.slice(0, 25);
  return teams.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 25);
}

export function getTeamEmoji(teamName = '', guild = null) {
  const q = teamName.trim().toLowerCase();
  const teams = loadTeams();
  const found = teams.find((t) => t.name.toLowerCase() === q);
  let emoji = found?.emoji || '🏆';

  if (guild) {
    const match = emoji.match(/<:([a-zA-Z0-9_]+):(\d+)>/);
    if (match) {
      const emojiName = match[1];
      const emojiId = match[2];
      const existingById = guild.emojis.cache.get(emojiId);
      if (!existingById) {
        const existingByName = guild.emojis.cache.find(
          (e) => e.name.toLowerCase() === emojiName.toLowerCase()
        );
        if (existingByName) {
          emoji = existingByName.toString();
        }
      }
    } else if (emoji === '🏆' || !found) {
      const shortName = teamName.replace(/^team\s+/i, '').trim().toLowerCase();
      const existingByName = guild.emojis.cache.find(
        (e) => e.name.toLowerCase() === shortName || e.name.toLowerCase() === q
      );
      if (existingByName) {
        emoji = existingByName.toString();
      }
    }
  }

  return emoji;
}
