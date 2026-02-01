/**
 * check-consist1 槽位
 * 
 * 职责：一致性检查 - 任务↔模块
 */

const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
    console.log('  → 检查任务与模块一致性...');

    const modules = context.modules || [];
    const tasks = context.sortedTasks || context.allTasks || [];

    const report = {
        covered: [],
        missing: [],
        extra: []
    };

    // 检查每个模块是否有对应任务
    for (const mod of modules) {
        const modTasks = tasks.filter(t => {
            const match = t.content.match(/\*\*关联模块[：:]\*\*\s*(\S+)/);
            return match && match[1].toLowerCase() === mod.id.toLowerCase();
        });

        if (modTasks.length > 0) {
            report.covered.push({ module: mod.id, name: mod.name, taskCount: modTasks.length });
        } else {
            report.missing.push({ module: mod.id, name: mod.name });
        }
    }

    // 检查是否有任务关联了不存在的模块
    const moduleIds = modules.map(m => m.id.toLowerCase());
    for (const task of tasks) {
        const match = task.content.match(/\*\*关联模块[：:]\*\*\s*(\S+)/);
        if (match && !moduleIds.includes(match[1].toLowerCase())) {
            report.extra.push({ task: task.id, module: match[1] });
        }
    }

    context.consistCheck1 = report;

    console.log(`  → 已覆盖: ${report.covered.length}, 缺失: ${report.missing.length}`);

    if (report.missing.length > 0) {
        console.log('  → 警告: 以下模块缺少任务:');
        report.missing.forEach(m => console.log(`    - ${m.module}: ${m.name}`));
    }

    return {};
};
