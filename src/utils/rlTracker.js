import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_EMOJIS = {
  'Supersonic Legend': '<:SSL:1497890201656103093>',
  'Grand Champion': '<:GC:1497890241456115843>',
  'Champion': '<:Champ:1497890282631335987>',
  'Diamond': '<:Diamond:1497890359144087632>',
  'Platin': '<:Platin:1497890388642627705>',
};

const DEFAULT_PLAYERS = [
  { name: 'wplaysg', tracker: 'https://rocketleague.tracker.network/rocket-league/profile/epic/Wplaysgツ/overview' },
  { name: 'water_wall', tracker: 'https://rocketleague.tracker.network/rocket-league/profile/epic/WaterxWall/overview' },
  { name: 'leon_willi', tracker: 'https://rocketleague.tracker.network/rocket-league/profile/epic/Zen_der205/overview' },
  { name: 'jakobking7', tracker: 'https://rocketleague.tracker.network/rocket-league/profile/epic/Kayr00n/overview' },
  { name: '_colbo', tracker: 'https://rocketleague.tracker.network/rocket-league/profile/epic/Colbo_GotY/overview' },
  { name: 'pax.4u', tracker: 'https://rocketleague.tracker.network/rocket-league/profile/epic/one8t/overview' },
  { name: 'rexmelonking2010_6915', tracker: 'https://rocketleague.tracker.network/rocket-league/profile/epic/RexyRL_/overview' },
  { name: 'jscathe', tracker: 'https://rocketleague.tracker.network/rocket-league/profile/epic/Sydoez/overview' },
  { name: 'armin2004', tracker: 'https://rocketleague.tracker.network/rocket-league/profile/steam/76561198315201888/overview' },
  { name: 'luca20650', tracker: 'https://rocketleague.tracker.network/rocket-league/profile/epic/FRAQ%20LUCA-_-/overview' },
  { name: 'fynnifynn08', tracker: 'https://rocketleague.tracker.network/rocket-league/profile/epic/fynnifynn08/overview' },
  { name: 'amotatix', tracker: 'https://rocketleague.tracker.network/rocket-league/profile/epic/AmoTatix/overview' },
  { name: 'nesquicc', tracker: 'https://rocketleague.tracker.network/rocket-league/profile/epic/Nesquickk./overview' },
  { name: 'knntx', tracker: 'https://rocketleague.tracker.network/rocket-league/profile/steam/76561198450219860/overview' },
  { name: 'byfrxzen', tracker: 'https://rocketleague.tracker.network/rocket-league/profile/epic/ByFrxzen/overview' },
];

export function loadEmojis() {
  const emojisPath = path.resolve(__dirname, '..', 'data', 'emojis.json');
  if (fs.existsSync(emojisPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(emojisPath, 'utf8'));
      if (Object.keys(data).length > 0) return { ...DEFAULT_EMOJIS, ...data };
    } catch {}
  }
  return DEFAULT_EMOJIS;
}

export function loadPlayers() {
  const playersPath = path.resolve(__dirname, '..', 'data', 'players.json');
  if (fs.existsSync(playersPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
      if (Array.isArray(raw) && raw.length > 0) {
        return raw.map((item) => ({
          name: typeof item === 'string' ? item : item.name || '',
          tracker: typeof item === 'string' ? '' : item.tracker || '',
        }));
      }
    } catch {}
  }
  return DEFAULT_PLAYERS;
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
  const url = `https://api.tracker.gg/api/v2/rocket-league/standard/profile/${targetPlatform}/${encodeURIComponent(targetId)}`;

  let json = null;

  try {
    const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';
    const args = [
      '-s',
      '-H', 'Referer: https://rocketleague.tracker.network/',
      '-H', 'Accept: application/json',
      '--user-agent', 'Chrome/79',
      url,
    ];

    const { stdout } = await execFileAsync(curlBin, args);
    if (stdout && stdout.startsWith('{')) {
      json = JSON.parse(stdout);
    }
  } catch (error) {
    try {
      const res = await fetch(url, {
        headers: {
          Referer: 'https://rocketleague.tracker.network/',
          Accept: 'application/json',
          'User-Agent': 'Chrome/79',
        },
      });
      if (res.ok) {
        json = await res.json();
      }
    } catch {}
  }

  if (json?.data) {
    const segments = json.data.segments || [];
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
        name: json.data.platformInfo?.platformUserHandle || targetId,
        mmr: calculatedMmr,
        mmr2s,
        mmr3s,
        rank: primary.stats?.tier?.metadata?.name || 'Unranked',
        division: primary.stats?.division?.metadata?.name || '',
        url: `https://rocketleague.tracker.network/rocket-league/profile/${targetPlatform}/${encodeURIComponent(targetId)}/overview`,
      };
    }
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
