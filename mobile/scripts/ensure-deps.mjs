#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const nodeModulesPath = path.resolve(projectRoot, 'node_modules');
const vueTscPath = path.resolve(nodeModulesPath, 'vue-tsc', 'bin', 'vue-tsc.js');

function checkDependencies() {
  // Vérifier si vue-tsc existe
  if (!fs.existsSync(vueTscPath)) {
    console.log('⚠️  Missing critical dependencies (vue-tsc not found)');
    console.log('📦 Running: npm install --legacy-peer-deps');
    return false;
  }

  // Vérifier si node_modules existe et a du contenu
  if (!fs.existsSync(nodeModulesPath) || fs.readdirSync(nodeModulesPath).length === 0) {
    console.log('⚠️  node_modules is empty or missing');
    console.log('📦 Running: npm install --legacy-peer-deps');
    return false;
  }

  console.log('✅ All dependencies are in place');
  return true;
}

function installDependencies() {
  return new Promise((resolve, reject) => {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npm, ['install', '--legacy-peer-deps'], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Dependencies installed successfully');
        resolve();
      } else {
        console.error('❌ npm install failed with code', code);
        reject(new Error('npm install failed'));
      }
    });

    child.on('error', (err) => {
      console.error('❌ Error running npm install:', err);
      reject(err);
    });
  });
}

async function main() {
  try {
    if (!checkDependencies()) {
      await installDependencies();
    }
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main();
