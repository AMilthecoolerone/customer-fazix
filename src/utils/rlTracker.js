import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadEmojis() {
  const emojisPath = path.resolve(__dirname, '..', 'data', 'emojis.json');
  if (!fs.existsSync(emojisPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(emojisPath, 'utf8'));
  } catch {
    return {};
  }
}

export function loadPlayers() {
  const playersPath = path.resolve(__dirname, '..', 'data', 'players.json');
  if (!fs.existsSync(playersPath)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
    if (Array.isArray(raw)) {
      return raw.map((item) => {
        if (typeof item === 'string') {
          return { name: item, tracker: '' };
        }
        return {
          name: item.name || item.username || '',
          tracker: item.tracker || item.url || item.link || '',
        };
      });
    } else if (typeof raw === 'object' && raw !== null) {
      return Object.entries(raw).map(([key, val]) => {
        if (typeof val === 'string') {
          return { name: key, tracker: val };
        }
        return {
          name: val.name || key,
          tracker: val.tracker || val.url || '',
        };
      });
    }
    return [];
  } catch {
    return [];
  }
}

export function findPlayer(query = '') {
  const q = query.trim().toLowerCase();
  const players = loadPlayers();
  return players.find((p) => p.name.toLowerCase() === q);
}

export function searchPlayers(query = '') {
  const q = query.trim().toLowerCase();
  const players = loadPlayers();
  if (!q) return players.slice(0, 25);
  return players.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 25);
}

export function savePlayers(players) {
  const playersPath = path.resolve(__dirname, '..', 'data', 'players.json');
  const dir = path.dirname(playersPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(playersPath, JSON.stringify(players, null, 2), 'utf8');
}

export function addOrUpdatePlayer(name, tracker = '') {
  const cleanName = (name || '').trim();
  if (!cleanName) throw new Error('Spielername darf nicht leer sein.');

  let cleanTracker = (tracker || '').trim();
  if (!cleanTracker) {
    cleanTracker = `https://rocketleague.tracker.network/rocket-league/profile/epic/${encodeURIComponent(cleanName)}/overview`;
  }

  const players = loadPlayers();
  const index = players.findIndex((p) => p.name.toLowerCase() === cleanName.toLowerCase());

  let isNew = false;
  let player;

  if (index >= 0) {
    players[index].tracker = cleanTracker;
    player = players[index];
  } else {
    player = { name: cleanName, tracker: cleanTracker };
    players.push(player);
    isNew = true;
  }

  savePlayers(players);
  return { player, isNew };
}

export function deletePlayer(name) {
  const cleanName = (name || '').trim().toLowerCase();
  const players = loadPlayers();
  const index = players.findIndex((p) => p.name.toLowerCase() === cleanName);
  if (index === -1) {
    return { success: false, player: null };
  }
  const [deletedPlayer] = players.splice(index, 1);
  savePlayers(players);
  return { success: true, player: deletedPlayer };
}

export function getRankEmoji(rankName = '') {
  const custom = loadEmojis();
  const r = rankName.toLowerCase();

  if (r.includes('supersonic legend') || r.includes('ssl')) {
    return custom['Supersonic Legend'] || '';
  }
  if (r.includes('grand champion') || r.includes('gc')) {
    return custom['Grand Champion'] || '';
  }
  if (r.includes('champion')) {
    return custom['Champion'] || '';
  }
  if (r.includes('diamond')) {
    return custom['Diamond'] || '';
  }
  if (r.includes('platin')) {
    return custom['Platin'] || custom['Platinum'] || '';
  }

  return '';
}

export function parseTrackerInput(input = '') {
  const player = findPlayer(input);
  const target = player?.tracker || input;

  const urlRegex = /rocketleague\.tracker\.network\/rocket-league\/profile\/(epic|steam|psn|xbl|switch)\/([^/?#\s]+)/i;
  const match = target.match(urlRegex);

  if (match) {
    return {
      platform: match[1].toLowerCase(),
      identifier: decodeURIComponent(match[2]),
      matchedPlayer: player,
      originalInput: input,
    };
  }

  if (target.includes(':')) {
    const [platform, ...rest] = target.split(':');
    return {
      platform: platform.trim().toLowerCase(),
      identifier: rest.join(':').trim(),
      matchedPlayer: player,
      originalInput: input,
    };
  }

  return {
    platform: 'epic',
    identifier: (player?.name || input).trim(),
    matchedPlayer: player,
    originalInput: input,
  };
}

export async function fetchPlayerStats(platform, identifier, matchedPlayer = null) {
  const targetPlatform = platform || 'epic';
  const targetId = identifier || matchedPlayer?.name;

  try {
    const url = `https://api.tracker.gg/api/v2/rocket-league/standard/profile/${targetPlatform}/${encodeURIComponent(targetId)}`;
    const args = [
      '-s',
      '-H', 'Referer: https://rocketleague.tracker.network/',
      '-H', 'Accept: application/json',
      '--user-agent', 'Chrome/79',
      url,
    ];

    const { stdout } = await execFileAsync('curl.exe', args);

    if (stdout && stdout.startsWith('{')) {
      const data = JSON.parse(stdout);
      const segments = data.data?.segments || [];
      const rankedPlaylists = segments.filter((s) => s.type === 'playlist' && s.stats?.rating?.value);

      const p2s = rankedPlaylists.find((s) => s.metadata?.name === 'Ranked Doubles 2v2');
      const p3s = rankedPlaylists.find((s) => s.metadata?.name === 'Ranked Standard 3v3');

      const mmr2s = p2s?.stats?.rating?.value || 0;
      const mmr3s = p3s?.stats?.rating?.value || 0;

      let calculatedMmr = 0;
      if (mmr2s > 0 && mmr3s > 0) {
        calculatedMmr = Number((mmr2s * 0.7 + mmr3s * 0.3).toFixed(2));
      } else if (mmr2s > 0) {
        calculatedMmr = mmr2s;
      } else if (mmr3s > 0) {
        calculatedMmr = mmr3s;
      }

      const primary = p2s || p3s || rankedPlaylists[0];

      if (primary && calculatedMmr > 0) {
        return {
          name: data.data?.platformInfo?.platformUserHandle || targetId,
          mmr: calculatedMmr,
          mmr2s,
          mmr3s,
          rank: primary.stats?.tier?.metadata?.name || 'Unranked',
          division: primary.stats?.division?.metadata?.name || '',
          url: `https://rocketleague.tracker.network/rocket-league/profile/${targetPlatform}/${encodeURIComponent(targetId)}/overview`,
        };
      }
    }
  } catch (error) {
    console.error(`Error fetching live stats for ${targetId}:`, error.message);
  }

  return {
    name: targetId,
    mmr: 0,
    mmr2s: 0,
    mmr3s: 0,
    rank: 'Unranked',
    division: '',
    url: `https://rocketleague.tracker.network/rocket-league/profile/${targetPlatform}/${encodeURIComponent(targetId)}/overview`,
  };
}
