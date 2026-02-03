/**
 * sort-deps 槽位
 * 
 * 职责：分析任务依赖关系并拓扑排序
 */

const fs = require('fs');
const path = require('path');

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
    console.log('  → 分析依赖关系...');     

    const tasks = context.allTasks || [];   
    context._errors = context._errors || [];

    // 构建依赖图
    const depGraph = {};
    const taskMap = {};
    const duplicates = [];

    // 用于展开 MOD-xxxx：先建立模块编号到任务列表的索引
    const tasksByModuleIndex = new Map(); // MMMM -> [taskId...]
    for (const task of tasks) {
        const moduleIndex = taskIdToModuleIndex(task.id);
        if (!moduleIndex) continue;
        const list = tasksByModuleIndex.get(moduleIndex) || [];
        list.push(task.id);
        tasksByModuleIndex.set(moduleIndex, list);
    }

    for (const task of tasks) {
        if (taskMap[task.id]) {
            duplicates.push(task.id);
        }
        taskMap[task.id] = task;
        depGraph[task.id] = [];

        // 解析依赖
        const depMatch = task.content.match(/\*\*依赖[：:]\*\*\s*\n([\s\S]*?)(?=\n\s*\*\*|$)/);
        if (depMatch) {
            const depBlock = depMatch[1];

            const taskDeps = depBlock.match(/\b[A-Z]+-\d{4}-\d{4}\b/g) || [];
            const moduleDepsRaw = depBlock.match(/\bMOD-\d{3,4}\b/gi) || [];

            const expanded = [];
            const missingModuleDeps = [];
            for (const moduleDep of moduleDepsRaw) {
                const moduleIndex = moduleIdToIndex(moduleDep);
                const normalized = normalizeModuleId(moduleDep) || String(moduleDep).toUpperCase();

                if (!moduleIndex) {
                    missingModuleDeps.push(normalized);
                    continue;
                }

                const moduleTasks = tasksByModuleIndex.get(moduleIndex) || [];
                if (moduleTasks.length === 0) {
                    missingModuleDeps.push(normalized);
                    continue;
                }

                expanded.push(...moduleTasks);
            }

            depGraph[task.id] = [...new Set([...taskDeps, ...expanded])];

            // 不直接 stop：只记录问题，保证 split 仍能产出任务列表
            if (missingModuleDeps.length > 0) {
                context._errors.push({
                    slot: 'sort-deps',
                    error: '模块依赖无法展开（找不到对应模块任务）',
                    taskId: task.id,
                    modules: [...new Set(missingModuleDeps)]
                });
            }
        }
    }

    if (duplicates.length > 0) {
        const unique = Array.from(new Set(duplicates));
        console.log(`  → 错误: 检测到重复任务 ID (${unique.length} 个): ${unique.slice(0, 10).join(', ')}${unique.length > 10 ? ' ...' : ''}`);
        context._errors.push({ slot: 'sort-deps', error: '检测到重复任务 ID', duplicates: unique });
        return { stop: true };
    }

    // 拓扑排序
    const sorted = topologicalSort(Object.keys(depGraph), depGraph);      

    if (!sorted) {
        console.log('  → 警告: 检测到循环依赖');
        context._errors.push({ slot: 'sort-deps', error: '检测到循环依赖' });
        context.sortedTasks = tasks;
    } else {
        context.sortedTasks = sorted.map(id => taskMap[id]).filter(Boolean);
        console.log(`  → 排序完成，共 ${context.sortedTasks.length} 个任务`);
    }

    return {};
};

/**
 * 拓扑排序
 */
function topologicalSort(nodes, deps) {
    const result = [];
    const visited = {};
    const visiting = {};

    function visit(node) {
        if (visiting[node]) return false;
        if (visited[node]) return true;

        visiting[node] = true;

        for (const dep of deps[node] || []) {
            if (nodes.includes(dep) && !visit(dep)) {
                return false;
            }
        }

        visiting[node] = false;
        visited[node] = true;
        result.push(node);

        return true;
    }

    for (const node of nodes) {
        if (!visit(node)) return null;
    }

    return result;
}
