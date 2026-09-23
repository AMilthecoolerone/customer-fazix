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

export function getRankFromMmr(mmr) {
  const num = Number(mmr) || 0;
  if (num >= 1860) return 'Supersonic Legend';
  if (num >= 1435) return 'Grand Champion';
  if (num >= 1075) return 'Champion';
  if (num >= 835) return 'Diamond';
  if (num >= 595) return 'Platin';
  if (num > 0) return 'Gold';
  return 'Unranked';
}

export function loadPlayers() {
  const playersPath = path.resolve(__dirname, '..', 'data', 'players.json');
  if (!fs.existsSync(playersPath)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
    if (Array.isArray(raw)) {
      return raw.map((item) => {
        if (typeof item === 'string') {
          return { name: item, tracker: '', mmr: 0, rank: 'Unranked' };
        }
        const mmr =
          item.mmr !== undefined && item.mmr !== null && !isNaN(Number(item.mmr))
            ? Number(item.mmr)
            : 0;
        const rank = item.rank || (mmr > 0 ? getRankFromMmr(mmr) : 'Unranked');
        return {
          name: item.name || item.username || '',
          tracker: item.tracker || item.url || item.link || '',
          mmr,
          rank,
        };
      });
    } else if (typeof raw === 'object' && raw !== null) {
      return Object.entries(raw).map(([key, val]) => {
        if (typeof val === 'string') {
          return { name: key, tracker: val, mmr: 0, rank: 'Unranked' };
        }
        const mmr =
          val.mmr !== undefined && val.mmr !== null && !isNaN(Number(val.mmr))
            ? Number(val.mmr)
            : 0;
        const rank = val.rank || (mmr > 0 ? getRankFromMmr(mmr) : 'Unranked');
        return {
          name: val.name || key,
          tracker: val.tracker || val.url || '',
          mmr,
          rank,
        };
      });
    }
    return [];
  } catch {
    return [];
  }
}

export function findPlayer(query = '') {
  if (!query) return null;
  let q = query.trim().toLowerCase();
  // Strip trailing (xxx MMR) or [xxx MMR] if copied from autocomplete
  q = q.replace(/\s*[\(\[]\d+\s*mmr[\)\]]$/i, '').trim();
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
  const cleanList = players.map((p) => {
    const entry = {
      name: p.name,
      tracker: p.tracker || '',
    };
    if (p.mmr !== undefined && p.mmr !== null && !isNaN(Number(p.mmr)) && Number(p.mmr) > 0) {
      entry.mmr = Number(p.mmr);
    }
    if (p.rank && p.rank !== 'Unranked') {
      entry.rank = p.rank;
    }
    return entry;
  });
  fs.writeFileSync(playersPath, JSON.stringify(cleanList, null, 2), 'utf8');
}

export function addOrUpdatePlayer(name, tracker = '', mmr = null, rank = null) {
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

  const parsedMmr =
    mmr !== null && mmr !== undefined && !isNaN(Number(mmr)) ? Number(mmr) : null;
  const determinedRank =
    rank || (parsedMmr !== null && parsedMmr > 0 ? getRankFromMmr(parsedMmr) : null);

  if (index >= 0) {
    if (tracker) players[index].tracker = cleanTracker;
    if (parsedMmr !== null) players[index].mmr = parsedMmr;
    if (determinedRank) players[index].rank = determinedRank;
    player = players[index];
  } else {
    player = {
      name: cleanName,
      tracker: cleanTracker,
      mmr: parsedMmr !== null ? parsedMmr : 0,
      rank: determinedRank || (parsedMmr ? getRankFromMmr(parsedMmr) : 'Unranked'),
    };
    players.push(player);
    isNew = true;
  }

  savePlayers(players);
  return { player, isNew };
}

export function setPlayerMmr(name, mmr, rank = null) {
  const cleanName = (name || '').trim();
  if (!cleanName) throw new Error('Spielername darf nicht leer sein.');

  const parsedMmr = Number(mmr);
  if (isNaN(parsedMmr) || parsedMmr < 0) {
    throw new Error('MMR muss eine gültige positive Zahl sein.');
  }

  const determinedRank = rank || getRankFromMmr(parsedMmr);

  const players = loadPlayers();
  const index = players.findIndex((p) => p.name.toLowerCase() === cleanName.toLowerCase());

  let player;
  let isNew = false;

  if (index >= 0) {
    players[index].mmr = parsedMmr;
    players[index].rank = determinedRank;
    player = players[index];
  } else {
    player = {
      name: cleanName,
      tracker: `https://rocketleague.tracker.network/rocket-league/profile/epic/${encodeURIComponent(cleanName)}/overview`,
      mmr: parsedMmr,
      rank: determinedRank,
    };
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
  const trimmed = (input || '').trim();
  let matchedPlayer = findPlayer(trimmed);
  let target = matchedPlayer?.tracker || trimmed;
  let manualMmr = matchedPlayer?.mmr || 0;
  let manualRank = matchedPlayer?.rank || '';

  // Check if input has inline MMR (e.g. "player:1500" or "player 1500")
  if (!matchedPlayer) {
    const inlineMatch =
      trimmed.match(/^([^:]+):(\d{3,4})$/) || trimmed.match(/^(.+?)\s+(\d{3,4})$/);
    if (inlineMatch) {
      const candidateName = inlineMatch[1].trim();
      const candidateMmr = Number(inlineMatch[2]);
      const found = findPlayer(candidateName);
      if (found) {
        matchedPlayer = found;
        target = found.tracker || candidateName;
      } else {
        target = candidateName;
      }
      manualMmr = candidateMmr;
      manualRank = getRankFromMmr(candidateMmr);
    }
  }

  const urlRegex =
    /rocketleague\.tracker\.network\/rocket-league\/profile\/(epic|steam|psn|xbl|switch)\/([^/?#\s]+)/i;
  const match = target.match(urlRegex);

  if (match) {
    return {
      platform: match[1].toLowerCase(),
      identifier: decodeURIComponent(match[2]),
      matchedPlayer,
      originalInput: input,
      manualMmr,
      manualRank,
    };
  }

  if (target.includes(':')) {
    const [platform, ...rest] = target.split(':');
    const platLower = platform.trim().toLowerCase();
    if (['epic', 'steam', 'psn', 'xbl', 'switch'].includes(platLower)) {
      return {
        platform: platLower,
        identifier: rest.join(':').trim(),
        matchedPlayer,
        originalInput: input,
        manualMmr,
        manualRank,
      };
    }
  }

  return {
    platform: 'epic',
    identifier: (matchedPlayer?.name || target).trim(),
    matchedPlayer,
    originalInput: input,
    manualMmr,
    manualRank,
  };
}

export async function fetchPlayerStats(
  platform,
  identifier,
  matchedPlayer = null,
  manualMmr = 0,
  manualRank = ''
) {
  const targetPlatform = platform || 'epic';
  const targetId = identifier || matchedPlayer?.name;

  const effectiveMmr = manualMmr > 0 ? manualMmr : (matchedPlayer?.mmr || 0);
  const effectiveRank =
    manualRank || matchedPlayer?.rank || (effectiveMmr > 0 ? getRankFromMmr(effectiveMmr) : '');

  // Return manual MMR immediately to avoid Cloudflare blocks / network hangs
  if (effectiveMmr > 0) {
    return {
      name: matchedPlayer?.name || targetId,
      mmr: effectiveMmr,
      mmr2s: effectiveMmr,
      mmr3s: effectiveMmr,
      rank: effectiveRank || 'Unranked',
      division: '',
      url:
        matchedPlayer?.tracker ||
        `https://rocketleague.tracker.network/rocket-league/profile/${targetPlatform}/${encodeURIComponent(targetId)}/overview`,
    };
  }

  try {
    const url = `https://api.tracker.gg/api/v2/rocket-league/standard/profile/${targetPlatform}/${encodeURIComponent(targetId)}`;
    const args = [
      '-s',
      '--max-time', '3',
      '-H', 'Referer: https://rocketleague.tracker.network/',
      '-H', 'Accept: application/json',
      '--user-agent', 'Chrome/79',
      url,
    ];

    const { stdout } = await execFileAsync('curl.exe', args);

    if (stdout && stdout.startsWith('{')) {
      const data = JSON.parse(stdout);
      const segments = data.data?.segments || [];
      const rankedPlaylists = segments.filter(
        (s) => s.type === 'playlist' && s.stats?.rating?.value
      );

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
  } catch {}

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
