/**
 * VAAL 槽位脚本：标记任务完成
 * 
 * 职责：更新任务列表文件，标记当前任务为完成
 */

const fs = require('fs');

module.exports = async function (context) {
    const task = context.currentTask;
    if (!task) return {};

    // 更新任务状态
    task.status = 'done';
    context.stats.completed++;

    // 更新任务文件
    const taskPath = context.taskPath;
    if (taskPath && fs.existsSync(taskPath)) {
        let content = fs.readFileSync(taskPath, 'utf-8');
        const lines = content.split('\n');

        // 替换对应行
        const oldLine = lines[task.lineIndex];
        const newLine = oldLine.replace('- [ ]', '- [x]');
        lines[task.lineIndex] = newLine;

        fs.writeFileSync(taskPath, lines.join('\n'), 'utf-8');
        console.log('  → 任务已标记完成');
    }

    return {};
};
