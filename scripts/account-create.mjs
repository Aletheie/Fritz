import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { hashPassword, profileDirectory, tokenHash, updateProfile } from './lib/profile-store.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : process.argv[index + 1] || '';
}

/** Reads a line without echoing it on a TTY; piped input is read as-is. */
function readSecret(prompt) {
  if (!input.isTTY) {
    input.setEncoding('utf8');
    return new Promise((resolve) => input.once('data', (chunk) => resolve(String(chunk).trim())));
  }
  return new Promise((resolve, reject) => {
    let value = '';
    output.write(prompt);
    input.setRawMode(true);
    input.resume();
    const finish = (callback) => {
      input.setRawMode(false);
      input.pause();
      input.removeListener('data', onData);
      callback();
    };
    const onData = (chunk) => {
      const character = String(chunk);
      if (character === '\u0003') finish(() => reject(new Error('Zrušeno.')));
      else if (character === '\r' || character === '\n')
        finish(() => (output.write('\n'), resolve(value)));
      else if (character === '\u007f') value = value.slice(0, -1);
      else value += character;
    };
    input.on('data', onData);
  });
}

async function main() {
  if (process.argv.includes('--help')) {
    output.write(
      'Použití: node scripts/account-create.mjs [--username jmeno] [--password heslo]\n' +
        '--password je určený pro testy; heslo se jinak zadá skrytě.\n' +
        'Bez argumentů se údaje zadají interaktivně. Přepis existujícího účtu není povolen.\n',
    );
    return;
  }
  const readline = createInterface({ input, output });
  const username = (argument('--username') || (await readline.question('Uživatelské jméno: ')))
    .trim()
    .toLocaleLowerCase('en-US');
  readline.close();
  const password = argument('--password') || (await readSecret('Heslo: '));
  if (argument('--password'))
    process.stderr.write(
      'Upozornění: --password zůstává v historii shellu a ve výpisu procesů. Pro skutečný účet zadej heslo interaktivně.\n',
    );
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/u.test(username))
    throw new Error(
      'Uživatelské jméno smí obsahovat jen písmena, čísla, tečku, pomlčku a podtržítko.',
    );
  if (password.length < 12 || password.length > 500)
    throw new Error('Heslo musí mít 12 až 500 znaků.');

  const directory = profileDirectory();
  await updateProfile(
    directory,
    (profile) => {
      if (profile.passwordHash || profile.passkeys.length)
        throw new Error(
          'Účet už existuje. Pro obnovu použij node scripts/access-link.mjs --recover.',
        );
      profile.username = username;
      profile.passwordHash = hashPassword(password);
      // Matches the identity derivation of legacy password profiles.
      profile.accountId = tokenHash(`${profile.createdAt}\u0000${username}`);
    },
    { create: true },
  );
  output.write(`Účet ${username} byl vytvořen v ${directory}.\n`);
}

main().catch((error) => {
  output.write(
    `Chyba: ${error instanceof Error ? error.message : 'účet se nepodařilo vytvořit.'}\n`,
  );
  process.exitCode = 1;
});
