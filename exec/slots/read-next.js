/**
 * VAAL 槽位脚本：读取下一个任务
 *
 * 职责：从任务列表获取下一个待处理任务
 */

module.exports = async function (context) {
    const tasks = context.tasks || [];

    const completedFromFile = (context.completedTaskIds || []).map(id => String(id).toUpperCase());
    const completedIds = new Set([
        ...completedFromFile,
        ...tasks.filter(t => t.status === 'done').map(t => String(t.id).toUpperCase())
    ]);

    const taskById = new Map(tasks.map(t => [String(t.id).toUpperCase(), t]));
    const knownIds = new Set([...completedFromFile, ...taskById.keys()]);

    const pendingTasks = tasks.filter(t => t.status === 'pending');

    // 没有 pending：正常结束
    if (pendingTasks.length === 0) {
        console.log('  → 没有更多待处理任务');
        context.hasMore = false;
        context.currentTask = null;
        return { break: true };
    }

    // 选择第一个“可执行”的 pending（依赖为空或依赖全部 done）
    const blockedList = [];
    let nextTask = null;

    for (const task of tasks) {
        if (!task || task.status !== 'pending') continue;

        const deps = (task.dependencies || [])
            .map(d => String(d).trim().toUpperCase())
            .filter(Boolean);

        // 依赖 ID 不存在：数据错误，必须停止
        const missing = deps.filter(depId => !knownIds.has(depId));
        if (missing.length > 0) {
            console.error(`  ❌ 任务 ${task.id} 依赖不存在: ${missing.join(', ')}`);
            context.currentTask = null;
            context.hasMore = false;
            return { stop: true };
        }

        const incomplete = deps.filter(depId => !completedIds.has(depId));
        if (incomplete.length === 0) {
            nextTask = task;
            break;
        }

        blockedList.push({ task, blockedBy: incomplete });
    }

    if (!nextTask) {
        // 还有 pending，但都不可执行：打印阻塞清单并停止
        console.log('  → 没有可执行任务，剩余任务全部被依赖阻塞:');
        blockedList.forEach(item => {
            console.log(`    - ${item.task.id} → 等待 ${item.blockedBy.join(', ')}`);
        });

        // 轻量循环依赖提示：若所有阻塞原因都指向 pending 任务
        const allBlockedByPending = blockedList.every(item =>
            item.blockedBy.every(depId => taskById.get(depId)?.status === 'pending')
        );
        if (allBlockedByPending) {
            console.log('  ⚠️ 疑似存在循环依赖（所有任务都在等待其他未完成任务）');
        }

        context.hasMore = false;
        context.currentTask = null;
        return { stop: true };
    }

    // 记录任务开始时间（用于计算耗时）
    nextTask._startTime = new Date();

    context.currentTask = nextTask;
    console.log(`  → 当前任务: ${nextTask.task.substring(0, 50)}...`);

    return {};
};
