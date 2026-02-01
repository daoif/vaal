/**
 * sort-deps 槽位
 * 
 * 职责：分析任务依赖关系并拓扑排序
 */

const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
    console.log('  → 分析依赖关系...');

    const tasks = context.allTasks || [];

    // 构建依赖图
    const depGraph = {};
    const taskMap = {};

    for (const task of tasks) {
        taskMap[task.id] = task;
        depGraph[task.id] = [];

        // 解析依赖
        const depMatch = task.content.match(/\*\*依赖[：:]\*\*\s*\n([\s\S]*?)(?=\n\s*\*\*|$)/);
        if (depMatch) {
            const deps = depMatch[1].match(/([A-Z]+-\d+)/g) || [];
            depGraph[task.id] = deps;
        }
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
