/**
 * VAAL 槽位脚本：读取下一个任务
 * 
 * 职责：从任务列表获取下一个待处理任务
 */

module.exports = async function (context) {
    const tasks = context.tasks || [];

    // 找到第一个 pending 的任务
    const nextTask = tasks.find(t => t.status === 'pending');

    if (!nextTask) {
        console.log('  → 没有更多待处理任务');
        context.hasMore = false;
        context.currentTask = null;
        return { break: true };
    }

    // 记录任务开始时间（用于计算耗时）
    nextTask._startTime = new Date();

    context.currentTask = nextTask;
    console.log(`  → 当前任务: ${nextTask.task.substring(0, 50)}...`);

    return {};
};
