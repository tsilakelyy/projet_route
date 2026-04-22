import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';

const cwd = process.cwd();
const envPath = path.join(cwd, '.env');
const envExamplePath = path.join(cwd, '.env.example');

const PORT_KEYS = [
  { key: 'POSTGRES_HOST_PORT', fallback: '5433', label: 'PostgreSQL (host)' },
  { key: 'BACKEND_HOST_PORT', fallback: '8082', label: 'Backend API' },
  { key: 'CARTE_HOST_PORT', fallback: '3000', label: 'Carte offline' },
  { key: 'WEB_HOST_PORT', fallback: '5173', label: 'Web principal' },
  { key: 'FRONTEND_REACT_HOST_PORT', fallback: '3001', label: 'Frontend React' },
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

const findNextFreePort = async (startAt, used) => {
  let candidate = Math.max(1024, startAt);
  while (candidate <= 65535) {
    if (!used.has(candidate) && (await isPortFree(candidate))) {
      return candidate;
    }
    candidate += 1;
  }
  throw new Error('Aucun port libre disponible');
};

const autoAssignPorts = async (currentPorts) => {
  const next = {};
  const used = new Set();
  for (const item of PORT_KEYS) {
    const requested = Number(currentPorts[item.key]);
    if (isValidPort(requested) && !used.has(requested) && (await isPortFree(requested))) {
      next[item.key] = requested;
      used.add(requested);
      continue;
    }
    const fallback = isValidPort(requested) ? requested + 1 : Number(item.fallback) + 1;
    const freePort = await findNextFreePort(fallback, used);
    next[item.key] = freePort;
    used.add(freePort);
  }
  return next;
};

const upsertEnvValues = (raw, updates) => {
  const lines = raw.split(/\r?\n/);
  const seen = new Set();
  const out = lines.map((line) => {
    const idx = line.indexOf('=');
    if (idx <= 0) return line;
    const key = line.slice(0, idx).trim();
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${updates[key]}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) {
      out.push(`${key}=${value}`);
    }
  }

  return `${out.join('\n').replace(/\n+$/g, '')}\n`;
};

const runComposeUp = () =>
  new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'docker-compose' : 'docker-compose';
    const child = spawn(cmd, ['up', '-d'], { cwd, shell: true });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, output });
    });
  });

const openBrowser = (url) => {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  if (process.platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
};

const json = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
};

const htmlPage = (data) => {
  const rows = PORT_KEYS.map((item) => {
    const value = data.ports[item.key];
    const state = data.status[item.key];
    const badge = state.free ? 'Libre' : 'Occupe';
    const cls = state.free ? 'ok' : 'ko';
    return `
      <tr>
        <td>${item.label}</td>
        <td><code>${item.key}</code></td>
        <td><input id="${item.key}" type="number" min="1024" max="65535" value="${value}" /></td>
        <td><span class="badge ${cls}">${badge}</span></td>
      </tr>
    `;
  }).join('\n');

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Assistant Ports Docker</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 0; padding: 24px; background: #120728; color: #f8f3ff; }
    .card { max-width: 980px; margin: 0 auto; background: #21103f; border: 1px solid #3f2b6f; border-radius: 14px; padding: 20px; }
    h1 { margin: 0 0 6px; font-size: 24px; }
    p { margin: 0 0 16px; color: #dac6ff; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border-bottom: 1px solid #3b2d64; padding: 10px; text-align: left; }
    input { width: 100%; background: #150a2f; color: #fff; border: 1px solid #4d3a80; border-radius: 8px; padding: 8px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    button { border: 0; border-radius: 9px; padding: 10px 14px; font-weight: 600; cursor: pointer; }
    .primary { background: #7f3ffc; color: #fff; }
    .secondary { background: #3a2b63; color: #fff; }
    .badge { border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; }
    .ok { background: #214b35; color: #baf2d0; }
    .ko { background: #6a2337; color: #ffd2dd; }
    .status { margin-top: 14px; min-height: 20px; color: #d9cbff; }
    .status.ok { color: #a9f0cc; }
    .status.err { color: #ffd4dc; }
    .mono { font-family: Consolas, monospace; font-size: 12px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Votre port est deja utilise</h1>
    <p>Le code fonctionne, mais un autre service occupe un ou plusieurs ports. Choisissez des ports libres puis cliquez sur le bouton.</p>
    <table>
      <thead><tr><th>Service</th><th>Variable</th><th>Port</th><th>Etat</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="actions">
      <button class="secondary" id="auto">Choisir des ports libres automatiquement</button>
      <button class="primary" id="apply">Changer les ports et demarrer</button>
    </div>
    <div id="status" class="status"></div>
    <div id="log" class="mono"></div>
  </div>
  <script>
    const keys = ${JSON.stringify(PORT_KEYS.map((x) => x.key))};
    const statusEl = document.getElementById('status');
    const logEl = document.getElementById('log');

    const payload = () => {
      const ports = {};
      keys.forEach((k) => ports[k] = Number(document.getElementById(k).value || 0));
      return { ports };
    };

    document.getElementById('auto').addEventListener('click', async () => {
      statusEl.className = 'status';
      statusEl.textContent = 'Recherche de ports libres...';
      logEl.textContent = '';
      const res = await fetch('/auto', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        statusEl.className = 'status err';
        statusEl.textContent = data.message || 'Erreur auto assignation';
        return;
      }
      keys.forEach((k) => { document.getElementById(k).value = data.ports[k]; });
      statusEl.className = 'status ok';
      statusEl.textContent = 'Ports libres proposes. Cliquez sur "Changer les ports et demarrer".';
    });

    document.getElementById('apply').addEventListener('click', async () => {
      statusEl.className = 'status';
      statusEl.textContent = 'Application des ports et demarrage en cours...';
      logEl.textContent = '';
      const res = await fetch('/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload())
      });
      const data = await res.json();
      if (!res.ok) {
        statusEl.className = 'status err';
        statusEl.textContent = data.message || 'Echec';
        if (data.output) logEl.textContent = data.output;
        return;
      }
      statusEl.className = 'status ok';
      statusEl.textContent = 'Ports changes. Redirection vers la page de login...';
      logEl.textContent = data.output || '';
      setTimeout(() => window.location.href = data.loginUrl, 1800);
    });
  </script>
</body>
</html>`;
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk.toString();
      if (data.length > 2_000_000) reject(new Error('Body too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

const createState = async () => {
  const env = readEnvState();
  const status = await getPortStatus(env.ports);
  return { ...env, status };
};

const start = async () => {
  const state = await createState();
  const serverPort = await findNextFreePort(8790, new Set());
  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url || req.method == null) {
        json(res, 400, { message: 'Requete invalide' });
        return;
      }

      if (req.method === 'GET' && req.url === '/') {
        const fresh = await createState();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(htmlPage(fresh));
        return;
      }

      if (req.method === 'POST' && req.url === '/auto') {
        const fresh = await createState();
        const ports = await autoAssignPorts(fresh.ports);
        json(res, 200, { ports });
        return;
      }

      if (req.method === 'POST' && req.url === '/apply') {
        const rawBody = await readBody(req);
        const body = JSON.parse(rawBody || '{}');
        const incoming = body?.ports || {};
        const picked = {};
        const seen = new Set();

        for (const item of PORT_KEYS) {
          const value = Number(incoming[item.key]);
          if (!isValidPort(value)) {
            json(res, 400, { message: `Port invalide pour ${item.key}` });
            return;
          }
          if (seen.has(value)) {
            json(res, 400, { message: `Doublon de port detecte: ${value}` });
            return;
          }
          seen.add(value);
          picked[item.key] = String(value);
        }

        for (const item of PORT_KEYS) {
          const value = Number(picked[item.key]);
          const free = await isPortFree(value);
          if (!free) {
            json(res, 400, { message: `Le port ${value} est deja occupe` });
            return;
          }
        }

        const current = readEnvState();
        const updated = upsertEnvValues(current.raw, picked);
        fs.writeFileSync(envPath, updated, 'utf8');

        const compose = await runComposeUp();
        if (compose.code !== 0) {
          json(res, 500, {
            message: 'Ports enregistres, mais echec docker compose up -d',
            output: compose.output,
          });
          return;
        }

        json(res, 200, {
          message: 'Ports changes et services demarres',
          output: compose.output,
          loginUrl: `http://localhost:${picked.WEB_HOST_PORT}`,
        });
        return;
      }

      json(res, 404, { message: 'Not found' });
    } catch (error) {
      json(res, 500, { message: error.message || 'Erreur interne' });
    }
  });

  server.listen(serverPort, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${serverPort}`;
    console.log(`[port-assistant] Ouvrir: ${url}`);
    console.log('[port-assistant] Si un port est occupe, cliquez "Choisir des ports libres automatiquement".');
    openBrowser(url);
  });
};

start().catch((error) => {
  console.error('[port-assistant] Erreur:', error.message);
  process.exit(1);
});
