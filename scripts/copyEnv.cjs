const fs = require('fs');

const envType = process.argv[2]; // local, docker, or compose
const sourceMap = {
  local: '.env.example',
  docker: '.env.docker.example',
  compose: '.env.docker-compose.example',
};

const source = sourceMap[envType];
const dest = '.env';

if (!source) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment type. Use: local, docker, or compose');
  process.exit(1);
}

try {
  fs.copyFileSync(source, dest);
  // eslint-disable-next-line no-console
  console.log(`✅ Copied ${source} → ${dest}`);
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(`❌ Error copying ${source}: ${error.message}`);
  process.exit(1);
}
