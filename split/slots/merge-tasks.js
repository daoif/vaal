/**
 * merge-tasks 槽位
 * 
 * 职责：读取所有任务草稿，合并到 context.allTasks
 */

const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
    console.log('  → 合并任务...');

    const paths = context._paths || {};
    const tasksDraftPath = path.join(context._vaalRoot, paths.tasksDraft || '_workspace/split/tasks-draft');

    if (!fs.existsSync(tasksDraftPath)) {
        console.log('  → 错误: 任务草稿目录不存在');
        return { stop: true };
    }

    const files = fs.readdirSync(tasksDraftPath)
        .filter(f => f.endsWith('-tasks.md'))
        .sort();

    let allTasks = [];

    for (const file of files) {
        const content = fs.readFileSync(path.join(tasksDraftPath, file), 'utf-8');
        const tasks = parseTasks(content);
        allTasks = allTasks.concat(tasks);
    }

    context.allTasks = allTasks;
    console.log(`  → 共有 ${allTasks.length} 个任务`);

    return {};
};

/**
 * 解析任务
 */
function parseTasks(content) {
    const tasks = [];
    const lines = content.split('\n');

    let currentTask = null;
    let currentContent = [];

    for (const line of lines) {
        const match = line.match(/^- \[([ xX])\] \[([A-Z]+-\d+)\]\s*(.+)/);
        if (match) {
            if (currentTask) {
                currentTask.content = currentContent.join('\n');
                tasks.push(currentTask);
            }

            currentTask = {
                status: match[1].toLowerCase() === 'x' ? 'done' : 'pending',
                id: match[2],
                description: match[3],
                line: line
            };
            currentContent = [line];
        } else if (currentTask) {
            currentContent.push(line);
        }
    }

    if (currentTask) {
        currentTask.content = currentContent.join('\n');
        tasks.push(currentTask);
    }

    return tasks;
}
