import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const cwd = process.cwd();
const envPath = path.join(cwd, '.env');
const envExamplePath = path.join(cwd, '.env.example');

const PORT_KEYS = [
  { key: 'POSTGRES_HOST_PORT', fallback: '5433', label: 'PostgreSQL (host)' },
  { key: 'BACKEND_HOST_PORT', fallback: '8082', label: 'Backend API' },
  { key: 'CARTE_HOST_PORT', fallback: '3000', label: 'Carte offline' },
  { key: 'WEB_HOST_PORT', fallback: '5173', label: 'Web principal' },
  { key: 'MOBILE_HOST_PORT', fallback: '8100', label: 'Mobile' },
];

const isValidPort = (value) => Number.isInteger(value) && value >= 1024 && value <= 65535;

const parseEnv = (content) => {
  const map = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    map[key] = value;
  }
  return map;
};

const ensureEnvFile = () => {
  if (fs.existsSync(envPath)) return;
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    return;
  }
  fs.writeFileSync(envPath, '', 'utf8');
};

const readEnvState = () => {
  ensureEnvFile();
  const raw = fs.readFileSync(envPath, 'utf8');
  const parsed = parseEnv(raw);
  const ports = {};
  for (const item of PORT_KEYS) {
    ports[item.key] = parsed[item.key] || item.fallback;
  }
  return { raw, parsed, ports };
};

const isPortFree = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });

const getPortStatus = async (ports) => {
  const statuses = {};
  for (const item of PORT_KEYS) {
    const value = Number(ports[item.key]);
    if (!isValidPort(value)) {
      statuses[item.key] = { free: false, reason: 'invalid' };
      continue;
    }
    const free = await isPortFree(value);
    statuses[item.key] = { free, reason: free ? 'free' : 'occupied' };
  }
  return statuses;
};

const main = async () => {
  const { ports } = readEnvState();
  const statuses = await getPortStatus(ports);

  const occupiedPorts = Object.entries(statuses).filter(([_, status]) => !status.free);

  if (occupiedPorts.length === 0) {
    console.log('✓ Tous les ports sont disponibles. Lancement de docker-compose...');
    console.log('  - PostgreSQL: ' + ports.POSTGRES_HOST_PORT);
    console.log('  - Backend: ' + ports.BACKEND_HOST_PORT);
    console.log('  - Carte: ' + ports.CARTE_HOST_PORT);
    console.log('  - Web: ' + ports.WEB_HOST_PORT);
    console.log('  - Mobile: ' + ports.MOBILE_HOST_PORT);
    return true;
  }

  console.log('⚠ Certains ports sont déjà utilisés:');
  occupiedPorts.forEach(([key, status]) => {
    const item = PORT_KEYS.find(p => p.key === key);
    console.log(`  - ${item.label} (${item.key}): ${ports[key]} (occupé)`);
  });

  console.log('\n💡 Pour changer les ports, exécutez: npm run port-assistant');

  return false;
};

main().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Erreur:', error);
  process.exit(1);
});
