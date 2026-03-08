import {seedAdmin} from './seed/init-admin';

async function main() {
  console.log('Start Seeding');
  await seedAdmin();
  console.log('Seeding Complete');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
