#!/usr/bin/env node
/**
 * Rebuild report/tasks outputs from existing tasks-draft without calling AI.
 *
 * Runs slots:
 * - getDesign
 * - loadModules
 * - mergeTasks
 * - sortDeps
 * - checkConsist1
 * - (load existing user-stories.md)
 * - checkConsist2
 * - report
 */

const fs = require('fs');
const path = require('path');

async function main() {
    const vaalRoot = resolveVaalRoot(process.cwd());
    const repoRoot = path.dirname(vaalRoot);
    const templateConfigPath = path.join(vaalRoot, 'split', 'templates', 'config.template.json');
    if (!fs.existsSync(templateConfigPath)) {
        console.error(`[rebuild] missing config template: ${templateConfigPath}`);
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(templateConfigPath, 'utf-8'));
    const splitConfig = config.split || {};
    const paths = splitConfig.paths || {};

    const context = {
        _vaalRoot: vaalRoot,
        _projectRoot: repoRoot,
        _config: config,
        _splitConfig: splitConfig,
        _paths: paths,
        _errors: [],
        modules: [],
        userStories: [],
    };

    const slots = {
        getDesign: requireSlot(vaalRoot, 'split/slots/get-design.js'),
        loadModules: requireSlot(vaalRoot, 'split/slots/load-modules.js'),
        mergeTasks: requireSlot(vaalRoot, 'split/slots/merge-tasks.js'),
        sortDeps: requireSlot(vaalRoot, 'split/slots/sort-deps.js'),
        checkConsist1: requireSlot(vaalRoot, 'split/slots/check-consist1.js'),
        checkConsist2: requireSlot(vaalRoot, 'split/slots/check-consist2.js'),
        report: requireSlot(vaalRoot, 'split/slots/report.js'),
    };

    const steps = [
        ['getDesign', slots.getDesign],
        ['loadModules', slots.loadModules],
        ['mergeTasks', slots.mergeTasks],
        ['sortDeps', slots.sortDeps],
        ['checkConsist1', slots.checkConsist1],
        ['loadUserStories', () => loadUserStories(context)],
        ['checkConsist2', slots.checkConsist2],
        ['report', slots.report],
    ];

    for (const [name, fn] of steps) {
        console.log(`[rebuild] step: ${name}`);
        const result = await fn(context);
        if (result && result.stop) {
            console.error(`[rebuild] stopped at: ${name}`);
            process.exit(1);
        }
    }

    console.log('[rebuild] done');
}

function resolveVaalRoot(cwd) {
    const direct = path.resolve(cwd);
    if (fs.existsSync(path.join(direct, 'split')) && fs.existsSync(path.join(direct, '_workspace'))) {
        return direct;
    }

    const nested = path.join(direct, '.vaal');
    if (fs.existsSync(path.join(nested, 'split')) && fs.existsSync(path.join(nested, '_workspace'))) {
        return nested;
    }

    throw new Error(`[rebuild] cannot locate .vaal root from cwd: ${direct}`);
}

function requireSlot(vaalRoot, relPath) {
    const fullPath = path.resolve(vaalRoot, relPath);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`[rebuild] missing slot: ${relPath}`);
    }
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(fullPath);
}

function loadUserStories(context) {
    const paths = context._paths || {};
    const file = path.join(context._vaalRoot, paths.userStories || '_workspace/split/user-stories.md');
    if (!fs.existsSync(file)) {
        console.log('[rebuild] user-stories.md not found; skip');
        context.userStories = [];
        return {};
    }

    const content = fs.readFileSync(file, 'utf-8');
    const matches = content.matchAll(/### (US-\d+):\s*(.+)/g);
    context.userStories = Array.from(matches, m => ({ id: m[1], title: m[2] }));
    console.log(`[rebuild] loaded user stories: ${context.userStories.length}`);
    return {};
}

main().catch(err => {
    console.error('[rebuild] fatal:', err && err.message ? err.message : String(err));
    process.exit(1);
});
