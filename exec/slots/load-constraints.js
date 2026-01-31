/**
 * VAAL 槽位脚本：加载约束
 * 
 * 职责：从任务描述中解析约束信息，并传递给后续槽位
 */

module.exports = async function (context) {
    const task = context.currentTask;
    if (!task) return {};

    const content = task.rawLine || task.task;

    // 解析约束
    const constraints = {
        hard: [],
        soft: [],
        dependencies: [],
        risks: []
    };

    const lines = content.split('\n');
    let currentSection = null;

    for (const line of lines) {
        const trimmed = line.trim().toLowerCase();

        // 检测约束类型标题
        if (trimmed.includes('硬约束') || trimmed.includes('hard')) {
            currentSection = 'hard';
            continue;
        }
        if (trimmed.includes('软约束') || trimmed.includes('soft')) {
            currentSection = 'soft';
            continue;
        }
        if (trimmed.includes('依赖') || trimmed.includes('depend')) {
            currentSection = 'dependencies';
            continue;
        }
        if (trimmed.includes('风险') || trimmed.includes('risk')) {
            currentSection = 'risks';
            continue;
        }

        // 解析列表项
        if (currentSection) {
            const listMatch = line.match(/^[-*]\s*(.+)/);
            if (listMatch) {
                constraints[currentSection].push(listMatch[1].trim());
            }
        }
    }

    // 检查依赖是否满足
    const completedIds = (context.tasks || [])
        .filter(t => t.status === 'done')
        .map(t => t.id);

    for (const dep of constraints.dependencies) {
        const match = dep.match(/([A-Z]+-\d+)/i);
        if (match && !completedIds.includes(match[1])) {
            console.log(`  → 依赖未满足: ${match[1]}`);
            context.stats.skipped++;
            return { break: true };
        }
    }

    // 将约束存入上下文
    context.constraints = constraints;

    // 构建约束提示（供 execute 槽位使用）
    if (constraints.hard.length || constraints.risks.length) {
        let prompt = '\n\n【约束提示】';
        if (constraints.hard.length) {
            prompt += '\n硬约束: ' + constraints.hard.join('; ');
        }
        if (constraints.risks.length) {
            prompt += '\n注意风险: ' + constraints.risks.join('; ');
        }
        context.constraintPrompt = prompt;
        console.log(`  → 已加载约束: ${constraints.hard.length} 硬约束, ${constraints.risks.length} 风险`);
    }

    return {};
};
