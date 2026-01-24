import {hashPassword} from '../user/utils';

async function main() {
  const password = '123456';
  for (let i = 0; i < 10; i++) {
    const passwordHash = await hashPassword(password);
    console.log('passwordHash', passwordHash);
  }
}

main();
