/**
 * validate-format 槽位
 * 
 * 职责：验证刚生成的任务文件格式
 */

const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
    const mod = context._currentModule;
    if (!mod) {
        return {};
    }

    const paths = context._paths || {};
    const tasksDraftPath = path.join(context._vaalRoot, paths.tasksDraft || '_workspace/split/tasks-draft');
    const taskFile = path.join(tasksDraftPath, `${mod.id}-tasks.md`);

    if (!fs.existsSync(taskFile)) {
        console.log('  → 警告: 任务文件不存在，跳过验证');
        return {};
    }

    const content = fs.readFileSync(taskFile, 'utf-8');
    const errors = [];

    // 检查是否包含任务行
    const taskLines = content.match(/^- \[([ x])\] \[(?:TEST|IMPL|FIX|REFACTOR|DOC)-\d+\]/gm) || [];
    if (taskLines.length === 0) {
        errors.push('未找到符合格式的任务行');
    }

    // 检查任务 ID 是否有重复
    const ids = [];
    const idMatches = content.matchAll(/\[(TEST|IMPL|FIX|REFACTOR|DOC)-(\d+)\]/g);
    for (const match of idMatches) {
        const id = `${match[1]}-${match[2]}`;
        if (ids.includes(id)) {
            errors.push(`重复的任务 ID: ${id}`);
        }
        ids.push(id);
    }

    // 检查任务 ID 数字部分是否满足 4 位（MMTT）
    const badIds = [];
    const idMatches2 = content.matchAll(/\[(TEST|IMPL|FIX|REFACTOR|DOC)-(\d+)\]/g);
    for (const match of idMatches2) {
        const num = match[2];
        if (num.length !== 4) {
            badIds.push(`${match[1]}-${num}`);
        }
    }
    if (badIds.length > 0) {
        errors.push(`任务 ID 数字部分必须为 4 位（MMTT），发现: ${badIds.slice(0, 10).join(', ')}${badIds.length > 10 ? ' ...' : ''}`);
    }

    // 检查是否有关联模块
    if (!content.includes('**关联模块:**') && !content.includes('**关联模块：**')) {
        errors.push('任务缺少关联模块标记');
    }

    if (errors.length > 0) {
        console.log(`  → 格式警告 (${errors.length} 条):`);
        errors.forEach(e => console.log(`    - ${e}`));
        context._errors.push({ slot: 'validate-format', module: mod.id, errors });
    } else {
        console.log(`  → 格式验证通过 (${taskLines.length} 个任务)`);
    }

    return {};
};
