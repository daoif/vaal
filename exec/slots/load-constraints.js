/**
 * VAAL 槽位脚本：加载约束
 * 
 * 职责：从项目/模块/任务三个层级加载约束，合并后传递给后续槽位
 * 
 * 约束层级（从上到下合并）：
 * 1. 项目级约束 - 来自 config.paths.projectConstraints 或项目根目录的 AGENTS.md
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
    const config = context._config;
    const paths = config.paths || {};

    // 尝试的路径顺序
    const candidates = [];

    // 1. 用户配置的路径
    if (paths.projectConstraints) {
        candidates.push(path.resolve(context._vaalRoot, paths.projectConstraints));
    }

    // 2. 常见的 agents 文件（相对于项目根目录）
    const agentFiles = ['AGENTS.md', 'agents.md', 'CLAUDE.md', '.cursorrules'];
    for (const file of agentFiles) {
        candidates.push(path.resolve(context.projectRoot, file));
    }

    // 3. 默认的 VAAL 项目约束文件
    candidates.push(path.resolve(context._vaalRoot, '_workspace/exec/project-constraints.md'));

    for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const constraints = parseConstraints(content);
            if (constraints.hard.length || constraints.soft.length || constraints.risks.length) {
                console.log(`  → 已加载项目约束: ${path.basename(filePath)}`);
                return constraints;
            }
        }
    }

    return { hard: [], soft: [], dependencies: [], risks: [] };
}

/**
 * 加载模块级约束
 */
function loadModuleConstraints(moduleName, context) {
    const config = context._config;
    const paths = config.paths || {};
    const moduleDir = path.resolve(
        context._vaalRoot,
        paths.moduleConstraints || '_workspace/split/design/modules'
    );

    const possibleNames = [
        `${moduleName}.md`,
        `${moduleName.toLowerCase()}.md`,
        `${moduleName.replace(/\s+/g, '-')}.md`,
        `${moduleName.replace(/\s+/g, '_')}.md`
    ];

    for (const fileName of possibleNames) {
        const modulePath = path.join(moduleDir, fileName);
        if (fs.existsSync(modulePath)) {
            const content = fs.readFileSync(modulePath, 'utf-8');
            console.log(`  → 已加载模块约束: ${fileName}`);
            return parseConstraints(content);
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

    // 5. 检查依赖是否满足
    const completedIds = (context.completedTaskIds || []).map(id => id.toUpperCase());

    for (const dep of constraints.dependencies) {
        const idMatches = dep.match(/([A-Z]+-\d+)/gi);
        if (idMatches) {
            for (const rawId of idMatches) {
                const depId = rawId.toUpperCase();
                if (!completedIds.includes(depId)) {
                    console.log(`  → 依赖未满足: ${depId}`);
                    context.stats.skipped++;
                    return { break: true };
                }
            }
        }
    }

    // 6. 存入上下文
    context.constraints = constraints;
    context.moduleName = moduleName;

    // 7. 构建约束提示
    let prompt = '';

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
