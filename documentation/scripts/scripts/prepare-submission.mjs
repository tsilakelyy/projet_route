import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const cleanOnly = process.argv.includes('--clean-only');

const generatedPaths = [
  'node_modules',
  'crypto/node_modules',
  'front-crypto/node_modules',
  'front-crypto/dist',
  'mobile/node_modules',
  'mobile/dist',
  'mobile/android/app/build',
  'mobile/android/.gradle',
  'fournisseurIdentite/target',
];

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    stdio: 'ignore',
    windowsHide: true,
    ...options,
  });
}

function isDirectory(pathname) {
  try {
    return statSync(pathname).isDirectory();
  } catch {
    return false;
  }
}

function toLongPath(pathname) {
  if (process.platform !== 'win32') {
    return pathname;
  }

  if (pathname.startsWith('\\\\?\\')) {
    return pathname;
  }

  return `\\\\?\\${pathname}`;
}

function clearWindowsAttributes(absolutePath) {
  if (process.platform !== 'win32' || !existsSync(absolutePath)) {
    return;
  }

  runCommand('cmd.exe', ['/d', '/s', '/c', `attrib -R -S -H "${absolutePath}\\*" /S /D`]);
}

function mirrorEmptyDirectory(absolutePath) {
  if (process.platform !== 'win32' || !existsSync(absolutePath) || !isDirectory(absolutePath)) {
    return;
  }

  const emptyDir = mkdtempSync(resolve(tmpdir(), 'projet-route-empty-'));
  try {
    runCommand('robocopy', [emptyDir, absolutePath, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP']);
  } finally {
    rmSync(emptyDir, { recursive: true, force: true });
  }
}

function stopMobileGradleDaemons() {
  const mobileAndroidDir = resolve(root, 'mobile/android');
  const gradlewBat = resolve(mobileAndroidDir, 'gradlew.bat');
  const gradlewSh = resolve(mobileAndroidDir, 'gradlew');

  if (!existsSync(mobileAndroidDir)) {
    return;
  }

  if (process.platform === 'win32' && existsSync(gradlewBat)) {
    runCommand('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat clean'], { cwd: mobileAndroidDir });
    runCommand('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat --stop'], { cwd: mobileAndroidDir });
    return;
  }

  if (existsSync(gradlewSh)) {
    runCommand(gradlewSh, ['clean'], { cwd: mobileAndroidDir });
    runCommand(gradlewSh, ['--stop'], { cwd: mobileAndroidDir });
  }
}

function removePath(absolutePath, label) {
  if (!existsSync(absolutePath)) {
    return;
  }

  try {
    rmSync(toLongPath(absolutePath), { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  } catch (error) {
    if (process.platform === 'win32') {
      clearWindowsAttributes(absolutePath);
      mirrorEmptyDirectory(absolutePath);

      try {
        const renamedPath = resolve(root, `.delete-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
        renameSync(absolutePath, renamedPath);
        absolutePath = renamedPath;
      } catch {
        // keep original path when rename fails because of an active lock
      }

      try {
        rmSync(toLongPath(absolutePath), { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
      } catch {
        runCommand('cmd.exe', ['/d', '/s', '/c', `rmdir /s /q "${absolutePath}"`]);
      }
    } else {
      runCommand('rm', ['-rf', absolutePath]);
    }
  }

  if (existsSync(absolutePath)) {
    console.warn(`[prepare-submission] could not fully remove ${label}`);
    return;
  }

  console.log(`[prepare-submission] removed ${label}`);
}

stopMobileGradleDaemons();

for (const relativePath of generatedPaths) {
  const absolutePath = resolve(root, relativePath);
  removePath(absolutePath, relativePath);
}

for (const entry of readdirSync(root)) {
  if (/^(hs_err_pid.*\.log|replay_pid.*\.log)$/i.test(entry)) {
    removePath(resolve(root, entry), entry);
  }
}

if (cleanOnly) {
  console.log('[prepare-submission] clean-only mode finished');
  process.exit(0);
}

function getDirectorySize(pathname) {
  let total = 0;
  const entries = readdirSync(pathname, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git') {
      continue;
    }
    const absolutePath = resolve(pathname, entry.name);
    if (entry.isDirectory()) {
      total += getDirectorySize(absolutePath);
      continue;
    }
    total += statSync(absolutePath).size;
  }
  return total;
}

const bytes = getDirectorySize(root);
const sizeMb = bytes / (1024 * 1024);
console.log(`[prepare-submission] project size (without .git): ${sizeMb.toFixed(2)} MB`);
if (sizeMb > 100) {
  console.warn('[prepare-submission] WARNING: size is above 100 MB');
} else {
  console.log('[prepare-submission] OK: size is under 100 MB');
}
