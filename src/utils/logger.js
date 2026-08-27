const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

function getTimestamp() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return `${colors.gray}[${date} ${time}]${colors.reset}`;
}

export const logger = {
  info(message, ...args) {
    console.log(`${getTimestamp()} ${colors.cyan}${colors.bold}[INFO]${colors.reset} ${message}`, ...args);
  },

  success(message, ...args) {
    console.log(`${getTimestamp()} ${colors.green}${colors.bold}[SUCCESS]${colors.reset} ${message}`, ...args);
  },

  warn(message, ...args) {
    console.warn(`${getTimestamp()} ${colors.yellow}${colors.bold}[WARN]${colors.reset} ${message}`, ...args);
  },

  debug(message, ...args) {
    console.log(`${getTimestamp()} ${colors.gray}${colors.bold}[DEBUG]${colors.reset} ${message}`, ...args);
  },

  error(message, error) {
    console.error(`${getTimestamp()} ${colors.red}${colors.bold}[ERROR]${colors.reset} ${message}`);
    if (error) {
      if (error instanceof Error && error.stack) {
        console.error(`${colors.dim}${error.stack}${colors.reset}`);
      } else {
        console.error(error);
      }
    }
  },
};
