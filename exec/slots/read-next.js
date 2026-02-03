/**
 * VAAL 槽位脚本：读取下一个任务
 *
 * 职责：从任务列表获取下一个待处理任务
 */

function isModuleId(value) {
    return /^MOD-\d{3,4}$/i.test(String(value || '').trim());
}

function normalizeModuleId(moduleId) {
    const match = String(moduleId || '')
        .trim()
        .toUpperCase()
        .match(/^MOD-(\d{3,4})$/);
    if (!match) return null;
    return `MOD-${String(match[1]).padStart(4, '0')}`;
}

function moduleIdToIndex(moduleId) {
    const normalized = normalizeModuleId(moduleId);
    if (!normalized) return null;
    return normalized.split('-')[1];
}

function taskIdToModuleIndex(taskId) {
    const match = String(taskId || '')
        .trim()
        .toUpperCase()
        .match(/^[A-Z]+-(\d{4})-\d{4}$/);
    return match ? match[1] : null;
}

module.exports = async function (context) {
    const tasks = context.tasks || [];

    const completedFromFile = (context.completedTaskIds || []).map(id => String(id).toUpperCase());
    const completedIds = new Set([
        ...completedFromFile,
        ...tasks.filter(t => t.status === 'done').map(t => String(t.id).toUpperCase())
    ]);

    const taskById = new Map(tasks.map(t => [String(t.id).toUpperCase(), t]));
    const knownIds = new Set([...completedFromFile, ...taskById.keys()]);       

    // 预计算：模块级依赖用到的索引
    // - module 完成语义：该模块编号下的所有任务都完成（即不存在 pending）
    const pendingCountByModuleIndex = new Map(); // MMMM -> pending count
    for (const task of tasks) {
        if (!task || task.status !== 'pending') continue;
        const moduleIndex = taskIdToModuleIndex(task.id);
        if (!moduleIndex) continue;
        pendingCountByModuleIndex.set(
            moduleIndex,
            (pendingCountByModuleIndex.get(moduleIndex) || 0) + 1
        );
    }

    // 模块存在性校验：依赖的 MOD-xxxx 至少要能在任务集合中找到一个匹配任务
    const knownModuleIndexes = new Set();
    for (const id of knownIds) {
        const moduleIndex = taskIdToModuleIndex(id);
        if (moduleIndex) knownModuleIndexes.add(moduleIndex);
    }

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

        const taskDepsRaw = (task.dependencies || [])
            .map(d => String(d).trim().toUpperCase())
            .filter(Boolean);

        const moduleDepsRaw = (task.moduleDependencies || [])
            .map(d => String(d).trim().toUpperCase())
            .filter(Boolean);

        // 向后兼容：旧数据可能把 MOD-xxx 混在 dependencies 里
        const moduleDepsFromTaskDeps = taskDepsRaw.filter(isModuleId);
        const taskDeps = taskDepsRaw.filter(depId => !isModuleId(depId));

        const moduleDepsUniq = [
            ...new Set(
                [...moduleDepsRaw, ...moduleDepsFromTaskDeps]
                    .map(normalizeModuleId)
                    .filter(Boolean)
            )
        ];

        // 依赖 ID 不存在：数据错误，必须停止
        const missingTaskDeps = taskDeps.filter(depId => !knownIds.has(depId));
        const missingModuleDeps = moduleDepsUniq.filter(modId => {
            const moduleIndex = moduleIdToIndex(modId);
            return !moduleIndex || !knownModuleIndexes.has(moduleIndex);
        });
        const missing = [...missingTaskDeps, ...missingModuleDeps];
        if (missing.length > 0) {
            console.error(`  ❌ 任务 ${task.id} 依赖不存在: ${missing.join(', ')}`);
            context.currentTask = null;
            context.hasMore = false;
            return { stop: true };
        }

        const incompleteTaskDeps = taskDeps.filter(depId => !completedIds.has(depId));
        const incompleteModuleDeps = moduleDepsUniq.filter(modId => {
            const moduleIndex = moduleIdToIndex(modId);
            if (!moduleIndex) return true;
            return (pendingCountByModuleIndex.get(moduleIndex) || 0) > 0;
        });
        const incomplete = [...incompleteTaskDeps, ...incompleteModuleDeps];
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
            item.blockedBy.every(depId => isModuleId(depId) || taskById.get(depId)?.status === 'pending')
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
