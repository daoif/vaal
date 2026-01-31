/**
 * VAAL 槽位脚本：加载任务
 * 
 * 职责：读取任务列表文件
 */

const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
    const config = context._config;
    const taskPath = path.resolve(context._vaalRoot, config.taskPath || 'tasks.md');

    console.log(`  → 加载任务列表: ${taskPath}`);

    if (!fs.existsSync(taskPath)) {
        console.log('  → 任务文件不存在');
        context.tasks = [];
        context.hasMore = false;
        return {};
    }

    const content = fs.readFileSync(taskPath, 'utf-8');
    const tasks = [];

    // 解析 Markdown 格式任务
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^- \[ \] (.+)/);
        if (match) {
            tasks.push({
                id: tasks.length + 1,
                lineIndex: i,
                task: match[1].trim(),
                status: 'pending',
                rawLine: line
            });
        }
    }

    context.tasks = tasks;
    context.taskPath = taskPath;
    console.log(`  → 找到 ${tasks.length} 个待处理任务`);

    if (tasks.length === 0) {
        context.hasMore = false;
    }

    return {};
};
