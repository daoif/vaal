/**
 * VAAL 槽位脚本：生成报告
 * 
 * 职责：输出执行统计，写入 progress.txt
 */

const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
    const stats = context.stats || {};
    const config = context._config || {};
    const paths = config.paths || {};

    const endTime = new Date();
    const startTime = stats.startTime || endTime;
    const totalDuration = formatDuration(endTime - startTime);

    // 控制台输出
    console.log('\n========================================');
    console.log('           执行报告');
    console.log('========================================');
    console.log(`开始时间: ${startTime.toLocaleString('zh-CN')}`);
    console.log(`结束时间: ${endTime.toLocaleString('zh-CN')}`);
    console.log(`总耗时: ${totalDuration}`);
    console.log(`已完成: ${stats.completed || 0}`);
    console.log(`失败: ${stats.failed || 0}`);
    console.log(`跳过: ${stats.skipped || 0}`);

    if (context._errors && context._errors.length > 0) {
        console.log('\n错误列表:');
        for (const err of context._errors) {
            console.log(`  - ${err.slot}: ${err.error}`);
        }
    }

    console.log('========================================\n');

    // 写入 progress.txt
    await writeProgress(context, startTime, endTime, totalDuration, paths);

    return {};
};

/**
 * 写入 progress.txt
 */
async function writeProgress(context, startTime, endTime, totalDuration, paths) {
    const progressPath = path.resolve(
        context._vaalRoot,
        paths.progress || '_workspace/exec/progress.txt'
    );

    const stats = context.stats || {};
    const records = context.taskRecords || [];

    // 构建本次执行记录
    let entry = `\n## ${startTime.toLocaleString('zh-CN')}\n\n`;

    // 如果有任务记录，输出表格
    if (records.length > 0) {
        entry += `| 时间 | 任务 | 状态 | 耗时 | 备注 |\n`;
        entry += `|------|------|------|------|------|\n`;

        for (const record of records) {
            const taskName = record.taskName.length > 30
                ? record.taskName.substring(0, 30) + '...'
                : record.taskName;
            entry += `| ${record.time} | [${record.taskId}] ${taskName} | ${record.status} | ${record.duration} | ${record.note} |\n`;
        }
    }

    // 添加失败记录
    if (context._errors && context._errors.length > 0) {
        for (const err of context._errors) {
            const time = new Date().toTimeString().split(' ')[0];
            entry += `| ${time} | ${err.slot} | ❌ 失败 | - | ${err.error.substring(0, 30)} |\n`;
        }
    }

    // 执行摘要
    const status = context.stopped ? '执行中断' : '执行完成';
    entry += `\n**${status}** - 总耗时: ${totalDuration}, 完成: ${stats.completed || 0}, 失败: ${stats.failed || 0}, 跳过: ${stats.skipped || 0}\n`;
    entry += `\n---\n`;

    // 确保目录存在
    const progressDir = path.dirname(progressPath);
    if (!fs.existsSync(progressDir)) {
        fs.mkdirSync(progressDir, { recursive: true });
    }

    // 如果文件不存在，先写入标题
    if (!fs.existsSync(progressPath)) {
        fs.writeFileSync(progressPath, '# VAAL 执行记录\n\n---\n', 'utf-8');
    }

    // 追加本次记录
    fs.appendFileSync(progressPath, entry, 'utf-8');
    console.log(`  → 已写入进度记录: ${progressPath}`);
}

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
