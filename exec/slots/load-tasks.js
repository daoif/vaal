/**
 * VAAL 槽位脚本：加载任务
 * 
 * 职责：读取任务列表文件，包括多行约束内容
 * 
 * 鲁棒性设计：
 * - 支持多种缩进格式（空格、Tab）
 * - 容忍任务ID格式变体
 * - 自动修正常见格式错误
 * - 跳过无法解析的行并记录警告
 */

const fs = require('fs');
const path = require('path');

/**
 * 将模块 ID 规范化为 4 位（如 MOD-001 -> MOD-0001）
 */
function normalizeModuleId(moduleId) {
    const match = String(moduleId || '')
        .trim()
        .toUpperCase()
        .match(/^MOD-(\d{3,4})$/);
    if (!match) return null;
    return `MOD-${String(match[1]).padStart(4, '0')}`;
}

/**
 * 从文本中提取模块 ID（如 MOD-001 / MOD-0001）
 */
function extractModuleIds(text) {
    if (!text) return [];
    const matches = String(text).match(/\bMOD-\d{3,4}\b/gi) || [];
    const normalized = matches.map(normalizeModuleId).filter(Boolean);
    return [...new Set(normalized)];
}

/**
 * 从文本中提取任务 ID（如 TEST-0001-0001 / IMPL-0001-0001）
 *
 * 注意：这里刻意排除模块 ID（MOD-xxxx）。
 */
function extractTaskIds(text) {
    if (!text) return [];
    const matches =
        String(text).match(/\b(?:[A-Z]+-\d{4}-\d{4}|[A-Z]+-\d+)\b/gi) || [];
    const upper = matches.map(id => String(id).toUpperCase());
    return upper.filter(id => !/^MOD-\d+$/i.test(id));
}

/**
 * 从任务 rawContent 中提取依赖任务 ID（仅从“依赖”段落提取）
 */
function extractDependenciesFromTaskContent(content) {
    const lines = String(content || '').split('\n');
    let inDependencies = false;
    const taskIds = [];
    const moduleIds = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const lower = trimmed.toLowerCase();

        const looksLikeHeader = trimmed.startsWith('#') || trimmed.startsWith('**') || /^[^\s]+[：:]$/.test(trimmed);
        const isDepsHeader =
            looksLikeHeader &&
            (lower.includes('依赖') || lower.includes('depend') || lower.includes('前置') || lower.startsWith('dependencies'));

        if (isDepsHeader) {
            inDependencies = true;
            taskIds.push(...extractTaskIds(trimmed));
            moduleIds.push(...extractModuleIds(trimmed));
            continue;
        }

        if (inDependencies) {
            const isOtherSectionHeader =
                looksLikeHeader &&
                (lower.includes('硬约束') ||
                    lower.includes('hard constraint') ||
                    lower.includes('软约束') ||
                    lower.includes('soft constraint') ||
                    lower.includes('风险') ||
                    lower.includes('risk') ||
                    lower.includes('验收') ||
                    lower.includes('acceptance') ||
                    lower.includes('测试') ||
                    lower.includes('test'));

            if (isOtherSectionHeader) {
                inDependencies = false;
                continue;
            }

            taskIds.push(...extractTaskIds(trimmed));
            moduleIds.push(...extractModuleIds(trimmed));
        }
    }

    // 清洗：去重 + 去空格 + 大写
    const uniqTaskIds = [
        ...new Set(taskIds.map(d => String(d).trim().toUpperCase()).filter(Boolean))
    ];
    const uniqModuleIds = [
        ...new Set(moduleIds.map(d => String(d).trim().toUpperCase()).filter(Boolean))
    ];

    return { taskIds: uniqTaskIds, moduleIds: uniqModuleIds };
}

module.exports = async function (context) {
    const config = context._config;
    const paths = config.paths || {};
    // 向后兼容：优先使用 paths.tasks，否则使用旧的 taskPath
    const taskPath = path.resolve(context._vaalRoot, paths.tasks || config.taskPath || '_workspace/exec/tasks.md');

    console.log(`  → 加载任务列表: ${taskPath}`);

    if (!fs.existsSync(taskPath)) {
        console.log('  → 任务文件不存在');
        context.tasks = [];
        context.hasMore = false;
        return {};
    }

    const content = fs.readFileSync(taskPath, 'utf-8');
    const tasks = [];
    const warnings = [];

    // 初始化已完成任务ID列表
    context.completedTaskIds = [];

    // 记录 ID 出现次数，用于唯一性校验（pending + done 都算）
    const idOccurrences = new Map(); // id -> { count, firstLine, statuses: Set }
    const recordId = (id, lineNum, status) => {
        const key = String(id).toUpperCase();
        const existing = idOccurrences.get(key);
        if (!existing) {
            idOccurrences.set(key, { count: 1, firstLine: lineNum, statuses: new Set([status]) });
            return;
        }
        existing.count++;
        existing.statuses.add(status);
    };

    // 解析 Markdown 格式任务（支持多行约束）
    const lines = content.split('\n');
    let currentTask = null;
    let autoId = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // 正则：匹配待完成任务行（鲁棒版本）
        // 支持：- [ ] , -[ ], * [ ], - [] 等变体
        const pendingMatch = line.match(/^[-*]\s*\[\s*\]\s*(.+)/);
        if (pendingMatch) {
            // 保存之前的任务
            if (currentTask) {
                tasks.push(currentTask);
            }

            const taskContent = pendingMatch[1].trim();

            // 提取任务 ID（支持多种格式）
            // 格式1: [IMPL-001] 描述
            // 格式2: IMPL-001: 描述
            // 格式3: (IMPL-001) 描述
            let taskId = null;
            const idPatterns = [
                /^\[([A-Z]+-(?:\d{4}-\d{4}|\d+))\]/i,      // [IMPL-001] / [IMPL-0001-0001]
                /^\(([A-Z]+-(?:\d{4}-\d{4}|\d+))\)/i,      // (IMPL-001) / (IMPL-0001-0001)
                /^([A-Z]+-(?:\d{4}-\d{4}|\d+)):/i,         // IMPL-001: / IMPL-0001-0001:
                /^([A-Z]+-(?:\d{4}-\d{4}|\d+))\s/i         // IMPL-001 (空格分隔) / IMPL-0001-0001 (空格分隔)
            ];

            for (const pattern of idPatterns) {
                const match = taskContent.match(pattern);
                if (match) {
                    taskId = match[1].toUpperCase();
                    break;
                }
            }

            // 如果没有找到ID，自动生成
            if (!taskId) {
                autoId++;
                taskId = `AUTO-${String(autoId).padStart(3, '0')}`;
                warnings.push(`行 ${lineNum}: 任务缺少ID，自动分配 ${taskId}`); 
            }

            recordId(taskId, lineNum, 'pending');

            currentTask = {
                id: taskId,
                lineIndex: i,
                task: taskContent,
                status: 'pending',
                rawContent: line,
                dependencies: []
            };
            continue;
        }

        // 正则：匹配已完成任务行（鲁棒版本）
        const doneMatch = line.match(/^[-*]\s*\[[xX✓✔]\]\s*(.+)/);
        if (doneMatch) {
            // 保存之前的任务
            if (currentTask) {
                tasks.push(currentTask);
                currentTask = null;
            }

            // 提取已完成任务的 ID
            const taskContent = doneMatch[1].trim();
            for (const pattern of [
                /^\[([A-Z]+-(?:\d{4}-\d{4}|\d+))\]/i,
                /^\(([A-Z]+-(?:\d{4}-\d{4}|\d+))\)/i,
                /^([A-Z]+-(?:\d{4}-\d{4}|\d+)):/i,
                /^([A-Z]+-(?:\d{4}-\d{4}|\d+))\s/i
            ]) {
                const match = taskContent.match(pattern);
                if (match) {
                    const doneId = match[1].toUpperCase();
                    context.completedTaskIds.push(doneId);
                    recordId(doneId, lineNum, 'done');
                    break;
                }
            }
            continue;
        }

        // 判断是否是缩进内容（约束、依赖等）
        // 支持：空格缩进、Tab缩进、或以 ** 开头的约束标题
        const isIndented = /^[\s\t]+/.test(line) || /^\s*\*\*/.test(line);
        const isEmpty = line.trim() === '';
        const isHeading = /^#+\s/.test(line);

        if (currentTask && (isIndented || isEmpty)) {
            // 累积到当前任务的 rawContent
            currentTask.rawContent += '\n' + line;
        } else if (currentTask && !isEmpty && !isHeading) {
            // 遇到非缩进、非空、非标题的内容
            // 检查是否看起来像约束内容但缺少缩进
            if (/^\*\*[^*]+:\*\*/.test(line.trim()) || /^[-*]\s+/.test(line.trim())) {
                // 可能是格式错误（约束内容没有缩进），仍然累积
                currentTask.rawContent += '\n' + line;
                warnings.push(`行 ${lineNum}: 约束内容可能缺少缩进`);
            } else {
                // 真的是新内容，结束当前任务
                tasks.push(currentTask);
                currentTask = null;
            }
        }
    }

    // 别忘了最后一个任务
    if (currentTask) {
        tasks.push(currentTask);
    }

    // 输出警告
    if (warnings.length > 0) {
        console.log(`  ⚠ 格式警告 (${warnings.length} 条):`);
        warnings.slice(0, 3).forEach(w => console.log(`    ${w}`));
        if (warnings.length > 3) {
            console.log(`    ... 还有 ${warnings.length - 3} 条警告`);
        }
    }

    // 预解析每个任务的依赖列表（供 read-next 判断“可执行”）
    for (const task of tasks) {
        const deps = extractDependenciesFromTaskContent(task.rawContent);
        const depTaskIds = Array.isArray(deps) ? deps : deps.taskIds;
        const depModuleIds = Array.isArray(deps) ? [] : deps.moduleIds;

        task.dependencies = depTaskIds;
        task.moduleDependencies = depModuleIds;

        // 禁止自依赖
        if (depTaskIds.includes(task.id)) {
            console.error(`  ❌ 任务 ${task.id} 存在自依赖（依赖了自己），请修复任务列表`);
            context.tasks = tasks;
            context.taskPath = taskPath;
            context.hasMore = false;
            return { stop: true };
        }
    }

    // ID 唯一性校验：同一 ID 不允许重复出现（pending/done 任何一种重复都算）
    const duplicates = [];
    for (const [id, info] of idOccurrences.entries()) {
        if (info.count > 1) {
            duplicates.push(id);
        }
    }
    if (duplicates.length > 0) {
        console.error(`  ❌ 任务 ID 重复: ${duplicates.join(', ')}`);
        context.tasks = tasks;
        context.taskPath = taskPath;
        context.hasMore = false;
        return { stop: true };
    }

    context.tasks = tasks;
    context.taskPath = taskPath;
    context._taskWarnings = warnings;

    console.log(`  → 找到 ${tasks.length} 个待处理任务`);
    if (context.completedTaskIds.length > 0) {
        console.log(`  → 已完成任务: ${context.completedTaskIds.join(', ')}`);
    }

    if (tasks.length === 0) {
        context.hasMore = false;
    }

    return {};
};
