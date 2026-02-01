/**
 * VAAL 槽位脚本：标记任务完成
 * 
 * 职责：更新任务列表文件，标记当前任务为完成，记录执行信息
 */

const fs = require('fs');

module.exports = async function (context) {
    const task = context.currentTask;
    if (!task) return {};

    // 计算耗时
    const endTime = new Date();
    const startTime = task._startTime || endTime;
    const durationMs = endTime - startTime;
    const durationStr = formatDuration(durationMs);

    // 更新任务状态
    task.status = 'done';
    context.stats.completed++;

    // 记录到 taskRecords（用于 progress.txt）
    context.taskRecords = context.taskRecords || [];
    context.taskRecords.push({
        time: endTime.toTimeString().split(' ')[0],  // HH:MM:SS
        taskId: task.id,
        taskName: task.task.substring(0, 40),
        status: '✅ 完成',
        duration: durationStr,
        note: context.lastCommitHash ? `commit: ${context.lastCommitHash}` : ''
    });

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

/**
 * 格式化时长
 */
function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
}
