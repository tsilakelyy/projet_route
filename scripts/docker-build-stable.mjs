#!/usr/bin/env node
import { spawn } from 'node:child_process';

const DEFAULT_SERVICES = ['backend', 'carte', 'web', 'mobile'];

function printUsage() {
  console.log(`Usage: node scripts/docker-build-stable.mjs [options]

Options:
  --services=backend,carte,web,mobile  Services to build (default: all)
  --no-cache                            Pass --no-cache to docker compose build
  --retries=3                           BuildKit retries per service
  --delay=15                            Delay in seconds between retries
  --prune                               Run docker buildx prune -f before builds
  --no-legacy-fallback                  Disable fallback with DOCKER_BUILDKIT=0
  --help                                Show this help
`);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function parseArgs(argv) {
  const envServices = process.env.DOCKER_BUILD_SERVICES
    ? process.env.DOCKER_BUILD_SERVICES.split(',').map((name) => name.trim()).filter(Boolean)
    : null;

  const options = {
    services: envServices && envServices.length > 0 ? envServices : [...DEFAULT_SERVICES],
    noCache: process.env.DOCKER_BUILD_NO_CACHE === '1',
    retries: parsePositiveInt(process.env.DOCKER_BUILD_RETRIES ?? '', 3),
    delay: parsePositiveInt(process.env.DOCKER_BUILD_DELAY ?? '', 15),
    prune: process.env.DOCKER_BUILD_PRUNE === '1',
    legacyFallback: process.env.DOCKER_BUILD_LEGACY_FALLBACK !== '0',
  };

  for (const arg of argv) {
    if (arg === '--help') {
      printUsage();
      process.exit(0);
    }
    if (arg === '--no-cache') {
      options.noCache = true;
      continue;
    }
    if (arg === '--prune') {
      options.prune = true;
      continue;
    }
    if (arg === '--no-legacy-fallback') {
      options.legacyFallback = false;
      continue;
    }
    if (arg.startsWith('--services=')) {
      const services = arg.split('=')[1].split(',').map((name) => name.trim()).filter(Boolean);
      if (services.length > 0) {
        options.services = services;
      }
      continue;
    }
    if (arg.startsWith('--retries=')) {
      options.retries = parsePositiveInt(arg.split('=')[1], options.retries);
      continue;
    }
    if (arg.startsWith('--delay=')) {
      options.delay = parsePositiveInt(arg.split('=')[1], options.delay);
      continue;
    }

    console.error(`[stable-build] Unknown option: ${arg}`);
    printUsage();
    process.exit(2);
  }

  return options;
}

function runCommand(command, args, envOverrides = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        ...envOverrides,
      },
    });

    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildWithBuildKit(service, options) {
  for (let attempt = 1; attempt <= options.retries; attempt += 1) {
    console.log(`[stable-build] ${service}: BuildKit attempt ${attempt}/${options.retries}`);

    const args = ['compose', '--progress=plain', 'build'];
    if (options.noCache) {
      args.push('--no-cache');
    }
    args.push(service);

    const code = await runCommand('docker', args, {
      DOCKER_BUILDKIT: '1',
      COMPOSE_DOCKER_CLI_BUILD: '1',
      BUILDKIT_PROGRESS: 'plain',
    });

    if (code === 0) {
      return true;
    }

    if (attempt < options.retries) {
      const waitSeconds = options.delay * attempt;
      console.log(`[stable-build] ${service}: waiting ${waitSeconds}s before retry`);
      await sleep(waitSeconds * 1000);
    }
  }

  return false;
}

async function buildWithLegacy(service, options) {
  console.log(`[stable-build] ${service}: trying legacy builder fallback`);
  const args = ['compose', 'build'];
  if (options.noCache) {
    args.push('--no-cache');
  }
  args.push(service);

  const code = await runCommand('docker', args, {
    DOCKER_BUILDKIT: '0',
    COMPOSE_DOCKER_CLI_BUILD: '0',
  });

  return code === 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const dockerCode = await runCommand('docker', ['version']);
  if (dockerCode !== 0) {
    console.error('[stable-build] Docker is not available.');
    process.exit(1);
  }

  if (options.prune) {
    console.log('[stable-build] pruning buildx cache');
    const pruneCode = await runCommand('docker', ['buildx', 'prune', '-f']);
    if (pruneCode !== 0) {
      console.error('[stable-build] buildx prune failed.');
      process.exit(pruneCode);
    }
  }

  console.log(`[stable-build] services: ${options.services.join(', ')}`);
  console.log(`[stable-build] no-cache: ${options.noCache ? 'yes' : 'no'}`);
  console.log(`[stable-build] retries: ${options.retries}`);
  console.log(`[stable-build] legacy fallback: ${options.legacyFallback ? 'on' : 'off'}`);

  for (const service of options.services) {
    const okWithBuildKit = await buildWithBuildKit(service, options);
    if (okWithBuildKit) {
      continue;
    }

    if (!options.legacyFallback) {
      console.error(`[stable-build] ${service}: failed with BuildKit and fallback disabled.`);
      process.exit(1);
    }

    const okWithLegacy = await buildWithLegacy(service, options);
    if (!okWithLegacy) {
      console.error(`[stable-build] ${service}: failed with BuildKit and legacy fallback.`);
      process.exit(1);
    }
  }

  console.log('[stable-build] all requested services built successfully.');
}

main().catch((error) => {
  console.error('[stable-build] unexpected error:', error?.message ?? error);
  process.exit(1);
});
