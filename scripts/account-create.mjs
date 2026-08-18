import { randomBytes, scryptSync } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

const DATA_DIR = resolve(
  process.env.WORTLY_AUTH_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/data' : 'data'),
);
const AUTH_PATH = join(DATA_DIR, 'auth.json');
const SCRYPT_OPTIONS = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : process.argv[index + 1] || '';
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, SCRYPT_OPTIONS);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

function readSecret(prompt) {
  if (!input.isTTY || !input.setRawMode) {
    return new Promise((resolveValue) => {
      let value = '';
      input.setEncoding('utf8');
      input.once('data', (chunk) => resolveValue(`${value}${String(chunk)}`.trim()));
    });
  }

  return new Promise((resolveValue, reject) => {
    let value = '';
    output.write(prompt);
    input.setRawMode(true);
    input.resume();
    const onData = (chunk) => {
      const character = String(chunk);
      if (character === '\u0003') {
        cleanup();
        reject(new Error('Zrušeno.'));
      } else if (character === '\r' || character === '\n') {
        output.write('\n');
        cleanup();
        resolveValue(value);
      } else if (character === '\u007f') {
        value = value.slice(0, -1);
      } else {
        value += character;
      }
    };
    const cleanup = () => {
      input.setRawMode(false);
      input.pause();
      input.removeListener('data', onData);
    };
    input.on('data', onData);
  });
}

function writeAccount(username, password) {
  mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  try {
    chmodSync(DATA_DIR, 0o700);
  } catch {}
  const account = {
    version: 1,
    username: username.trim().toLocaleLowerCase('en-US'),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    sessions: {},
  };
  const temporaryPath = `${AUTH_PATH}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(account, null, 2)}\n`, { mode: 0o600 });
  chmodSync(temporaryPath, 0o600);
  renameSync(temporaryPath, AUTH_PATH);
}

async function main() {
  if (process.argv.includes('--help')) {
    output.write(
      'Použití: node scripts/account-create.mjs [--username jmeno] [--password heslo]\n',
    );
    output.write(
      'Bez argumentů se údaje zadají interaktivně. Přepis existujícího účtu není povolen.\n',
    );
    return;
  }
  try {
    readFileSync(AUTH_PATH, 'utf8');
    throw new Error(
      'Účet už existuje. Pro změnu hesla nejdřív vědomě odstraň auth.json z datového volume.',
    );
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const readline = createInterface({ input, output });
  const username = (
    argument('--username') || (await readline.question('Uživatelské jméno: '))
  ).trim();
  readline.close();
  const password = argument('--password') || (await readSecret('Heslo: '));
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/u.test(username.toLocaleLowerCase('en-US'))) {
    throw new Error(
      'Uživatelské jméno smí obsahovat jen písmena, čísla, tečku, pomlčku a podtržítko.',
    );
  }
  if (password.length < 12 || password.length > 500) {
    throw new Error('Heslo musí mít 12 až 500 znaků.');
  }
  writeAccount(username, password);
  output.write(`Účet ${username.toLocaleLowerCase('en-US')} byl vytvořen v ${AUTH_PATH}.\n`);
}

main().catch((error) => {
  output.write(
    `Chyba: ${error instanceof Error ? error.message : 'účet se nepodařilo vytvořit.'}\n`,
  );
  process.exitCode = 1;
});
