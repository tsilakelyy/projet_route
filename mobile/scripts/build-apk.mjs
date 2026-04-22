import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = process.cwd();
const nodeModulesPath = resolve(projectRoot, 'node_modules');
const vueTscBinary = resolve(projectRoot, 'node_modules', 'vue-tsc', 'bin', 'vue-tsc.js');
const androidDir = resolve(projectRoot, 'android');
const apkPath = resolve(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

function run(command, args, options = {}) {
  console.log(`[apk-build] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(nodeModulesPath) || !existsSync(vueTscBinary)) {
  run('npm', ['ci', '--legacy-peer-deps', '--no-audit', '--no-fund']);
}

run('npm', ['run', 'build:ci']);
run('npx', ['cap', 'sync', 'android']);

const gradleCommand = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
run(gradleCommand, ['assembleDebug'], { cwd: androidDir });

if (!existsSync(apkPath)) {
  console.error(`[apk-build] APK not found at: ${apkPath}`);
  process.exit(1);
}

console.log(`[apk-build] APK ready: ${apkPath}`);
