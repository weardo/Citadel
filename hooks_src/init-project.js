#!/usr/bin/env node

/**
 * init-project.js — SessionStart hook
 *
 * Auto-scaffolds per-project Citadel state on first use.
 * Copies templates and utility scripts from the plugin root.
 * Idempotent — skips existing directories, overwrites scripts
 * to keep them in sync with plugin version.
 */

const fs = require('fs');
const path = require('path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const PLANNING_DIRS = [
  '.planning',
  '.planning/campaigns',
  '.planning/campaigns/completed',
  '.planning/coordination',
  '.planning/coordination/instances',
  '.planning/coordination/claims',
  '.planning/fleet',
  '.planning/fleet/briefs',
  '.planning/fleet/outputs',
  '.planning/intake',
  '.planning/postmortems',
  '.planning/research',
  '.planning/screenshots',
  '.planning/telemetry',
];

function shouldSyncScripts() {
  try {
    const pkgPath = path.join(PLUGIN_ROOT, 'package.json');
    if (!fs.existsSync(pkgPath)) return true; // can't determine — sync to be safe
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const pluginVersion = pkg.version || '0.0.0';

    const versionFile = path.join(PROJECT_ROOT, '.citadel', 'version.txt');
    if (!fs.existsSync(versionFile)) return true;

    const installedVersion = fs.readFileSync(versionFile, 'utf8').trim();
    return installedVersion !== pluginVersion;
  } catch {
    return true; // on any error, sync to be safe
  }
}

function writeVersionFile(pluginRoot, projectRoot) {
  try {
    const pkgPath = path.join(pluginRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) return;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    fs.writeFileSync(path.join(projectRoot, '.citadel', 'version.txt'), pkg.version || '0.0.0');
  } catch { /* non-fatal */ }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDirRecursive(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  try {
    // 1. Create .planning/ directory tree
    for (const dir of PLANNING_DIRS) {
      ensureDir(path.join(PROJECT_ROOT, dir));
    }

    // 1b. Sweep stale coordination claims from crashed sessions
    try {
      const coordScript = path.join(PROJECT_ROOT, '.citadel', 'scripts', 'coordination.js');
      const sweepScript = path.join(PLUGIN_ROOT, 'scripts', 'coordination.js');
      const script = fs.existsSync(coordScript) ? coordScript : sweepScript;
      if (fs.existsSync(script)) {
        require('child_process').spawnSync('node', [script, 'sweep'], {
          cwd: PROJECT_ROOT,
          env: { ...process.env, CLAUDE_PROJECT_DIR: PROJECT_ROOT },
          timeout: 5000,
        });
      }
    } catch { /* non-fatal — don't block session start */ }

    // 2. Copy templates from plugin to project
    const pluginTemplates = path.join(PLUGIN_ROOT, '.planning', '_templates');
    const projectTemplates = path.join(PROJECT_ROOT, '.planning', '_templates');
    if (fs.existsSync(pluginTemplates)) {
      copyDirRecursive(pluginTemplates, projectTemplates);
    }

    // 3. Copy intake template if missing
    const intakeTemplate = path.join(PROJECT_ROOT, '.planning', 'intake', '_TEMPLATE.md');
    const pluginIntakeTemplate = path.join(PLUGIN_ROOT, '.planning', 'intake', '_TEMPLATE.md');
    if (!fs.existsSync(intakeTemplate) && fs.existsSync(pluginIntakeTemplate)) {
      fs.copyFileSync(pluginIntakeTemplate, intakeTemplate);
    }

    // 4. Sync utility scripts to .citadel/scripts/ (version-gated to avoid unnecessary I/O)
    if (shouldSyncScripts()) {
      const pluginScripts = path.join(PLUGIN_ROOT, 'scripts');
      const projectScripts = path.join(PROJECT_ROOT, '.citadel', 'scripts');
      if (fs.existsSync(pluginScripts)) {
        ensureDir(projectScripts);
        for (const file of fs.readdirSync(pluginScripts)) {
          if (file.endsWith('.js') || file.endsWith('.cjs')) {
            fs.copyFileSync(
              path.join(pluginScripts, file),
              path.join(projectScripts, file)
            );
          }
        }
      }
      writeVersionFile(PLUGIN_ROOT, PROJECT_ROOT);
    }

    // 5. Copy agent-context if missing
    const agentContext = path.join(PROJECT_ROOT, '.claude', 'agent-context');
    const pluginAgentContext = path.join(PLUGIN_ROOT, '.claude', 'agent-context');
    if (!fs.existsSync(agentContext) && fs.existsSync(pluginAgentContext)) {
      copyDirRecursive(pluginAgentContext, agentContext);
    }

    // 6. Write .citadel-root marker (plugin path for reference)
    const citadelDir = path.join(PROJECT_ROOT, '.citadel');
    ensureDir(citadelDir);
    fs.writeFileSync(
      path.join(citadelDir, 'plugin-root.txt'),
      PLUGIN_ROOT
    );

  } catch (err) {
    // Non-fatal — don't block session start
    process.exit(0);
  }
}

main();
