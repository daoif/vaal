/**
 * report 槽位
 * 
 * 职责：生成报告 + 输出 tasks.md
 */

const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
    console.log('  → 生成报告...');

    const paths = context._paths || {};
    const modules = context.modules || [];
    const tasks = context.sortedTasks || context.allTasks || [];
    const userStories = context.userStories || [];
    const check1 = context.consistCheck1 || { covered: [], missing: [] };
    const check2 = context.consistCheck2 || { covered: [], missing: [] };
    const errors = context._errors || [];

    // 统计
    const testTasks = tasks.filter(t => t.id.startsWith('TEST-'));
    const implTasks = tasks.filter(t => t.id.startsWith('IMPL-'));

    // ========== 生成报告 ==========
    let report = `# 拆分报告

## 概览

| 项目 | 数量 |
|------|------|
| 模块 | ${modules.length} |
| 测试任务 | ${testTasks.length} |
| 实现任务 | ${implTasks.length} |
| 任务总计 | ${tasks.length} |
| 用户故事 | ${userStories.length} |

## 模块列表

`;

    for (const mod of modules) {
        report += `- **${mod.id.toUpperCase()}**: ${mod.name}\n`;
    }

    report += `
## 一致性检查

### 任务 ↔ 模块

`;

    if (check1.missing.length === 0) {
        report += '✅ 所有模块都有对应任务\n';
    } else {
        report += '⚠️ 以下模块缺少任务：\n';
        check1.missing.forEach(m => report += `- ${m.module}: ${m.name}\n`);
    }

    report += `
### 用户故事 ↔ 设计文档

`;

    if (check2.missing.length === 0) {
        report += '✅ 设计文档功能点已被用户故事覆盖\n';
    } else {
        report += '⚠️ 以下功能点可能未被覆盖：\n';
        check2.missing.slice(0, 10).forEach(fp => report += `- ${fp}\n`);
    }

    if (errors.length > 0) {
        report += `
## 错误

`;
        errors.forEach(err => report += `- **${err.slot}**: ${err.error || JSON.stringify(err.errors)}\n`);
    }

    report += `
## 任务预览

`;

    for (const task of tasks.slice(0, 10)) {
        const status = task.status === 'done' ? '[x]' : '[ ]';
        report += `- ${status} ${task.id}: ${task.description}\n`;
    }

    if (tasks.length > 10) {
        report += `\n... 还有 ${tasks.length - 10} 个任务\n`;
    }

    report += `
---

## 下一步

1. 审查以上报告和生成的 tasks.md
2. 如需修改，让 AI 直接编辑 tasks.md
3. 确认后即可执行：对 AI 说"帮我执行任务"
`;

    // 保存报告
    const reportPath = path.join(context._vaalRoot, paths.report || '_workspace/split/report.md');
    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`  → 报告已保存: ${path.basename(reportPath)}`);

    // ========== 生成 tasks.md ==========
    let tasksContent = `# 任务列表

> 由 VAAL Split 自动生成
> 生成时间: ${new Date().toISOString()}

`;

    for (const task of tasks) {
        tasksContent += task.content + '\n\n';
    }

    // 确保 exec 目录存在
    const tasksOutputPath = path.join(context._vaalRoot, paths.tasksOutput || '_workspace/exec/tasks.md');
    const tasksDir = path.dirname(tasksOutputPath);
    if (!fs.existsSync(tasksDir)) {
        fs.mkdirSync(tasksDir, { recursive: true });
    }

    fs.writeFileSync(tasksOutputPath, tasksContent, 'utf-8');
    console.log(`  → tasks.md 已保存: ${path.basename(tasksOutputPath)}`);
    console.log(`  → 共 ${tasks.length} 个任务`);

    return {};
};
