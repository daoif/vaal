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
    context._errors = context._errors || [];
    const tasksDraftPath = path.join(context._vaalRoot, paths.tasksDraft || '_workspace/split/tasks-draft');

    if (!fs.existsSync(tasksDraftPath)) {
        console.log('  → 错误: 任务草稿目录不存在');
        return { stop: true };
    }

    const files = fs.readdirSync(tasksDraftPath)
        .filter(f => f.endsWith('-tasks.md'))
        .sort();

    let allTasks = [];
    const duplicates = [];
    const seenTaskIds = new Map();

    for (const file of files) {
        const content = fs.readFileSync(path.join(tasksDraftPath, file), 'utf-8');
        const tasks = parseTasks(content);
        for (const task of tasks) {
            const prevFile = seenTaskIds.get(task.id);
            if (prevFile) {
                duplicates.push({ id: task.id, firstFile: prevFile, secondFile: file });
            } else {
                seenTaskIds.set(task.id, file);
            }
        }
        allTasks = allTasks.concat(tasks);
    }

    if (duplicates.length > 0) {
        console.log(`  → 错误: 检测到重复任务 ID (${duplicates.length} 处)，请先修复后再合并`);
        duplicates.slice(0, 20).forEach(d => {
            console.log(`    - ${d.id}: ${d.firstFile} <-> ${d.secondFile}`);
        });
        context._errors.push({ slot: 'merge-tasks', error: '检测到重复任务 ID', duplicates });
        return { stop: true };
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
        const match = line.match(/^- \[([ xX])\] \[([A-Z]+-\d{4}-\d{4})\]\s*(.+)/);
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
