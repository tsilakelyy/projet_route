#!/usr/bin/env node

/**
 * Script d'auto-réparation des dépendances
 * S'exécute avant npm install pour vérifier et réparer les node_modules manquants
 * 
 * Usage:
 * - Automatique via package.json (preinstall)
 * - Manuel: node scripts/repair-dependencies.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVICES = ['mobile', 'crypto', 'front-crypto', 'fournisseurIdentite'];
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('🔧 Auto-réparation des dépendances');
console.log('====================================\n');

let repairCount = 0;

SERVICES.forEach((service) => {
  const servicePath = path.join(PROJECT_ROOT, service);
  const packageJsonPath = path.join(servicePath, 'package.json');
  const nodeModulesPath = path.join(servicePath, 'node_modules');
  const targetPath = path.join(servicePath, 'target');
  const distPath = path.join(servicePath, 'dist');

  // Vérifier si le service existe
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`⏭️  ${service}: package.json non trouvé (skipped)`);
    return;
  }

  console.log(`📦 Vérification ${service}...`);

  // Vérifier les node_modules
  const nodeModulesExist = fs.existsSync(nodeModulesPath);
  const nodeModulesValid = nodeModulesExist && fs.readdirSync(nodeModulesPath).length > 0;

  if (!nodeModulesValid) {
    console.log(`   ⚠️  node_modules manquant ou vide`);
    repairCount++;
    
    try {
      console.log(`   🔄 Réinstallation via npm...`);
      process.chdir(servicePath);
      
      // Essayer npm ci d'abord, puis npm install
      try {
        execSync('npm ci --legacy-peer-deps 2>&1', { stdio: 'inherit' });
      } catch {
        console.log(`   ℹ️  npm ci échoué, tentative npm install...`);
        execSync('npm install --legacy-peer-deps 2>&1', { stdio: 'inherit' });
      }
      
      console.log(`   ✅ ${service}: Réparé`);
    } catch (error) {
      console.error(`   ❌ ${service}: Échec de réparation`);
      console.error(error.message);
      process.exit(1);
    }
  } else {
    console.log(`   ✅ node_modules OK`);
  }

  // Vérifier les dossiers de build
  if (service === 'fournisseurIdentite' && fs.existsSync(targetPath)) {
    console.log(`   ✅ target/ OK`);
  }
  
  if ((service === 'mobile' || service === 'front-crypto') && fs.existsSync(distPath)) {
    console.log(`   ✅ dist/ OK`);
  }

  console.log('');
});

process.chdir(PROJECT_ROOT);

console.log('====================================');
console.log(`✅ Auto-réparation terminée (${repairCount} service(s) réparé(s))`);

if (repairCount === 0) {
  console.log('✨ Toutes les dépendances sont intactes!');
}
