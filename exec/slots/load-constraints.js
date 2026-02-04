/**
 * VAAL 槽位脚本：加载约束
 *
 * 职责：从项目/模块/任务三个层级加载约束，合并后传递给后续槽位
 *
 * 约束层级（从上到下合并）：
 * 1. 项目级约束 - 固定来自 .vaal/_workspace/exec/project-constraints.md
 * 2. 模块级约束 - 来自 config.paths.moduleConstraints 目录下的模块文件
 * 3. 任务级约束 - 嵌入在任务描述中
 */

const fs = require('fs');
const path = require('path');

/**
 * 从文本内容中解析约束
 */
function parseConstraints(content) {
    const constraints = {
        hard: [],
        soft: [],
        dependencies: [],
        risks: []
    };

    const lines = content.split('\n');
    let currentSection = null;

    for (const line of lines) {
        const trimmed = line.trim();
        const lower = trimmed.toLowerCase();

        // 检测约束类型标题
        if (lower.includes('硬约束') || lower.includes('hard constraint')) {
            currentSection = 'hard';
            continue;
        }
        if (lower.includes('软约束') || lower.includes('soft constraint')) {
            currentSection = 'soft';
            continue;
        }
        if (lower.includes('依赖') || lower.includes('depend') || lower.includes('前置')) {
            currentSection = 'dependencies';
            continue;
        }
        if (lower.includes('风险') || lower.includes('risk') || lower.includes('注意')) {
            currentSection = 'risks';
            continue;
        }

        // 解析列表项
        if (currentSection && trimmed) {
            const listMatch = trimmed.match(/^[-*·•]\s*(.+)/) ||
                trimmed.match(/^\d+[.)]\s*(.+)/);
            if (listMatch) {
                const item = listMatch[1].trim();
                if (item && !item.match(/^[:\-*]+$/)) {
                    constraints[currentSection].push(item);
                }
            }
        }
    }

    return constraints;
}

/**
 * 合并两个约束对象
 */
function mergeConstraints(base, override) {
    return {
        hard: [...base.hard, ...override.hard],
        soft: [...base.soft, ...override.soft],
        dependencies: [...base.dependencies, ...override.dependencies],
        risks: [...base.risks, ...override.risks]
    };
}

/**
 * 从任务内容中提取关联模块名
 */
function extractModuleName(content) {
    const lines = content.split('\n');
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes('关联模块') || lower.includes('module:') || lower.includes('关联:')) {
            const match = line.match(/[:：]\s*(.+)/);
            if (match) {
                return match[1].trim().replace(/\*+/g, '').trim();
            }
        }
    }
    return null;
}

/**
 * 加载项目级约束
 */
function loadProjectConstraints(context) {
    const projectConstraintsPath = path.resolve(
        context._vaalRoot,
        '_workspace/exec/project-constraints.md'
    );

    if (!fs.existsSync(projectConstraintsPath)) {
        console.log('  → 未找到项目约束: project-constraints.md（将视为无项目级约束）');
        return { hard: [], soft: [], dependencies: [], risks: [] };
    }

    const content = fs.readFileSync(projectConstraintsPath, 'utf-8');
    const constraints = parseConstraints(content);
    if (constraints.hard.length || constraints.soft.length || constraints.risks.length) {
        console.log('  → 已加载项目约束: project-constraints.md');
    }

    return constraints;
}

/**
 * 加载模块级约束
 */
function loadModuleConstraints(moduleName, context) {
    const config = context._config;
    const paths = config.paths || {};

    const configuredDir = path.resolve(
        context._vaalRoot,
        paths.moduleConstraints || '_workspace/split/modules'
    );

    // 兼容历史默认值：旧版本默认使用 _workspace/split/design/modules
    // 同时 split 模块当前默认输出到 _workspace/split/modules
    const fallbackDirs = [
        configuredDir,
        path.resolve(context._vaalRoot, '_workspace/split/modules'),
        path.resolve(context._vaalRoot, '_workspace/split/design/modules')
    ];

    const moduleDirs = Array.from(new Set(fallbackDirs));

    const possibleNames = [
        `${moduleName}.md`,
        `${moduleName.toLowerCase()}.md`,
        `${moduleName.replace(/\s+/g, '-')}.md`,
        `${moduleName.replace(/\s+/g, '_')}.md`
    ];

    for (const moduleDir of moduleDirs) {
        for (const fileName of possibleNames) {
            const modulePath = path.join(moduleDir, fileName);
            if (fs.existsSync(modulePath)) {
                const content = fs.readFileSync(modulePath, 'utf-8');
                console.log(`  → 已加载模块约束: ${fileName}`);
                return parseConstraints(content);
            }
        }
    }

    return { hard: [], soft: [], dependencies: [], risks: [] };
}

module.exports = async function (context) {
    const task = context.currentTask;
    if (!task) return {};

    const content = task.rawContent || task.task;

    // 1. 加载项目级约束
    const projectConstraints = loadProjectConstraints(context);

    // 2. 提取关联模块名并加载模块级约束
    const moduleName = extractModuleName(content);
    const moduleConstraints = moduleName
        ? loadModuleConstraints(moduleName, context)
        : { hard: [], soft: [], dependencies: [], risks: [] };

    // 3. 解析任务级约束
    const taskConstraints = parseConstraints(content);

    // 4. 合并约束（项目 → 模块 → 任务）
    let constraints = mergeConstraints(projectConstraints, moduleConstraints);
    constraints = mergeConstraints(constraints, taskConstraints);

    // 5. 防御性断言：依赖检查已前移到 read-next，这里不应该再出现依赖未完成的任务
    const completedFromFile = (context.completedTaskIds || []).map(id => String(id).toUpperCase());
    const completedIds = new Set([
        ...completedFromFile,
        ...(context.tasks || []).filter(t => t.status === 'done').map(t => String(t.id).toUpperCase())
    ]);

    const knownIds = new Set([
        ...completedFromFile,
        ...(context.tasks || []).map(t => String(t.id).toUpperCase())
    ]);

    const deps = (task.dependencies || []).map(d => String(d).trim().toUpperCase()).filter(Boolean);
    for (const depId of deps) {
        if (!knownIds.has(depId) || !completedIds.has(depId)) {
            console.error(`  ❌ 断言失败：任务 ${task.id} 的依赖 ${depId} 未满足，但仍进入 load-constraints（read-next 应该已过滤）`);
            return { stop: true };
        }
    }

    // 6. 存入上下文
    context.constraints = constraints;
    context.moduleName = moduleName;

    // 7. 构建约束提示
    let prompt = `\n\n【系统约束】
- 代码位置由项目架构决定，不由验证覆盖范围决定
- 如果验证命令不覆盖目标目录，需同时更新验证配置`;

    if (constraints.hard.length) {
        prompt += '\n\n【硬约束（必须满足）】';
        constraints.hard.forEach((c, i) => prompt += `\n${i + 1}. ${c}`);
    }

    if (constraints.soft.length) {
        prompt += '\n\n【软约束（建议满足）】';
        constraints.soft.forEach((c, i) => prompt += `\n${i + 1}. ${c}`);
    }

    if (constraints.risks.length) {
        prompt += '\n\n【风险提示】';
        constraints.risks.forEach(c => prompt += `\n⚠️ ${c}`);
    }

    context.constraintPrompt = prompt;

    // 输出统计
    if (constraints.hard.length || constraints.soft.length || constraints.risks.length) {
        const parts = [];
        if (constraints.hard.length) parts.push(`${constraints.hard.length} 硬约束`);
        if (constraints.soft.length) parts.push(`${constraints.soft.length} 软约束`);
        if (constraints.risks.length) parts.push(`${constraints.risks.length} 风险`);
        console.log(`  → 约束合计: ${parts.join(', ')}`);
    }

    return {};
};
