#!/usr/bin/env node
/**
 * Renumber task IDs in tasks-draft to avoid cross-module collisions.
 *
 * New rule: IDs use split numeric part MMMM-TTTT
 * - MMMM: module number (four digits, from filename mod-XXX)
 * - TTTT: task sequence within the module (four digits, from 0001)
 *
 * This script updates:
 * - Task header lines: "- [ ] [TEST-....] ..." / "- [ ] [IMPL-....] ..."
 * - Dependency references inside the same file: "TEST-....", "IMPL-...."
 */

const fs = require('fs');
const path = require('path');

function main() {
    const vaalRoot = resolveVaalRoot(process.cwd());
    const tasksDraftDir = path.join(vaalRoot, '_workspace', 'split', 'tasks-draft');

    if (!fs.existsSync(tasksDraftDir)) {
        console.error(`[renumber] tasks-draft dir not found: ${tasksDraftDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(tasksDraftDir)
        .filter(f => f.endsWith('-tasks.md') && f.startsWith('mod-'))
        .sort();

    if (files.length === 0) {
        console.error('[renumber] no *-tasks.md files found');
        process.exit(1);
    }

    let changedFiles = 0;
    const leftovers = [];

    for (const file of files) {
        const fullPath = path.join(tasksDraftDir, file);
        const before = fs.readFileSync(fullPath, 'utf-8');
        const { after, mapping, moduleCode } = renumberOneFile(before, file);

        if (Object.keys(mapping).length === 0) {
            console.warn(`[renumber] skip (no task IDs found): ${file}`);
            continue;
        }

        if (after !== before) {
            fs.writeFileSync(fullPath, after, 'utf-8');
            changedFiles++;
            console.log(`[renumber] updated: ${file} (module ${moduleCode}, ${Object.keys(mapping).length} ids)`);
        } else {
            console.log(`[renumber] unchanged: ${file} (module ${moduleCode})`);
        }

        const remain = (after.match(/\b(?:TEST|IMPL)-\d{1,4}\b(?!-)/g) || []).slice(0, 10);
        if (remain.length > 0) {
            leftovers.push({ file, remain });
        }
    }

    if (leftovers.length > 0) {
        console.warn('[renumber] warning: found leftover short IDs (likely cross-module references):');
        for (const item of leftovers) {
            console.warn(`  - ${item.file}: ${item.remain.join(', ')}`);
        }
    }

    console.log(`[renumber] done: ${changedFiles}/${files.length} files changed`);
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

    throw new Error(`[renumber] cannot locate .vaal root from cwd: ${direct}`);
}

function renumberOneFile(content, filename) {
    const moduleCode = getModuleCodeFromFilename(filename);
    const lines = content.split('\n');

    // Collect old numeric parts in order of first appearance (per file).
    const oldNumOrder = [];
    const seenOldNums = new Set();

    for (const line of lines) {
        const m = line.match(/^- \[[ xX]\] \[(TEST|IMPL)-(\d+(?:-\d+)?)\]/);
        if (!m) continue;
        const oldNum = m[2];
        if (!seenOldNums.has(oldNum)) {
            seenOldNums.add(oldNum);
            oldNumOrder.push(oldNum);
        }
    }

    const mapping = {}; // oldFullId -> newFullId
    for (let i = 0; i < oldNumOrder.length; i++) {
        const oldNum = oldNumOrder[i];
        const seq = String(i + 1).padStart(4, '0');
        const newNum = `${moduleCode}-${seq}`;
        mapping[`TEST-${oldNum}`] = `TEST-${newNum}`;
        mapping[`IMPL-${oldNum}`] = `IMPL-${newNum}`;
    }

    let after = content;
    for (const [oldId, newId] of Object.entries(mapping)) {
        const re = new RegExp(`\\b${escapeRegExp(oldId)}\\b`, 'g');
        after = after.replace(re, newId);
    }

    return { after, mapping, moduleCode };
}

function getModuleCodeFromFilename(filename) {
    const m = String(filename).match(/^mod-(\d{3})-tasks\.md$/);
    if (!m) {
        throw new Error(`[renumber] unexpected filename: ${filename}`);
    }
    const modNum = Number.parseInt(m[1], 10);
    if (!Number.isFinite(modNum)) {
        throw new Error(`[renumber] invalid module number in filename: ${filename}`);
    }
    return String(modNum).padStart(4, '0');
}

function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main();
