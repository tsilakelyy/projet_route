#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONTROLLERS_DIR = path.join(ROOT, 'fournisseurIdentite', 'src', 'main', 'java', 'com', 'projet', 'route', 'controller');
const COLLECTION_PATH = path.join(ROOT, 'documentation', 'postman', 'ProjetRoute.postman_collection.new.json');

function normalizePath(rawPath) {
  return rawPath
    .replace(/\{[^}]+:[^}]+\}/g, '{var}')
    .replace(/\{[^}]+\}/g, '{var}')
    .replace(/\/+/g, '/');
}

function parseControllerEndpoints() {
  const files = fs.readdirSync(CONTROLLERS_DIR).filter((name) => name.endsWith('Controller.java'));
  const endpoints = [];

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(CONTROLLERS_DIR, fileName), 'utf8');
    const classBase = content.match(/@RequestMapping\("([^"]+)"\)/)?.[1] ?? '';
    const lines = content.split(/\r?\n/);

    let pendingMethod = null;
    let pendingPath = '';

    for (const line of lines) {
      const mapping = line.match(/@(GetMapping|PostMapping|PutMapping|DeleteMapping)(?:\("([^"]*)"\))?/);
      if (mapping) {
        pendingMethod = mapping[1].replace('Mapping', '').toUpperCase();
        pendingPath = mapping[2] ?? '';
        continue;
      }

      if (pendingMethod && line.includes('public ')) {
        endpoints.push({
          method: pendingMethod,
          path: normalizePath(`${classBase}${pendingPath}` || '/'),
          source: fileName,
        });
        pendingMethod = null;
        pendingPath = '';
      }
    }
  }

  endpoints.push({ method: 'GET', path: '/', source: 'HomeController.java' });
  endpoints.push({ method: 'GET', path: '/swagger-ui/index.html', source: 'SwaggerDocs' });
  endpoints.push({ method: 'GET', path: '/v3/api-docs', source: 'SwaggerDocs' });

  return uniqueEndpoints(endpoints);
}

function parsePostmanEndpoints() {
  const collection = JSON.parse(fs.readFileSync(COLLECTION_PATH, 'utf8'));
  const endpoints = [];

  function visit(items) {
    for (const item of items ?? []) {
      if (item.request) {
        const rawUrl = typeof item.request.url === 'string' ? item.request.url : (item.request.url?.raw ?? '');
        const normalized = normalizePath(
          rawUrl
            .replace(/^\{\{baseUrl\}\}/, '')
            .replace(/\?.*$/, '')
            .replace(/\{\{[^}]+\}\}/g, '{var}'),
        );

        endpoints.push({
          method: String(item.request.method || '').toUpperCase(),
          path: normalized || '/',
          source: item.name,
        });
      }

      if (item.item) {
        visit(item.item);
      }
    }
  }

  visit(collection.item);
  return uniqueEndpoints(endpoints);
}

function uniqueEndpoints(endpoints) {
  const seen = new Map();
  for (const endpoint of endpoints) {
    const key = `${endpoint.method} ${endpoint.path}`;
    if (!seen.has(key)) {
      seen.set(key, endpoint);
    }
  }
  return [...seen.values()];
}

function main() {
  const apiEndpoints = parseControllerEndpoints();
  const postmanEndpoints = parsePostmanEndpoints();

  const postmanKeys = new Set(postmanEndpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`));
  const apiKeys = new Set(apiEndpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`));

  const missingInPostman = apiEndpoints.filter((endpoint) => !postmanKeys.has(`${endpoint.method} ${endpoint.path}`));
  const extraInPostman = postmanEndpoints.filter((endpoint) => !apiKeys.has(`${endpoint.method} ${endpoint.path}`));

  console.log(`API endpoints: ${apiEndpoints.length}`);
  console.log(`Postman endpoints: ${postmanEndpoints.length}`);
  console.log(`Missing in Postman: ${missingInPostman.length}`);
  console.log(`Extra in Postman: ${extraInPostman.length}`);

  if (missingInPostman.length > 0) {
    console.log('\nMissing endpoints:');
    for (const endpoint of missingInPostman) {
      console.log(`- ${endpoint.method} ${endpoint.path} (${endpoint.source})`);
    }
  }

  if (extraInPostman.length > 0) {
    console.log('\nExtra endpoints:');
    for (const endpoint of extraInPostman) {
      console.log(`- ${endpoint.method} ${endpoint.path} (${endpoint.source})`);
    }
  }

  if (missingInPostman.length > 0) {
    process.exitCode = 1;
  }
}

main();
