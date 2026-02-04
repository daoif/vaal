/**
 * VAAL 槽位脚本：调用 Codex CLI
 * 
 * 职责：使用 Codex CLI 执行任务
 */

const { execSync } = require('child_process');

module.exports = async function (context) {   
    const task = context.currentTask;
    if (!task) return {};

    // 组合任务描述和约束提示
    let prompt = task.task;
    if (context.constraintPrompt) {
        prompt += context.constraintPrompt;   
    }
    if (context.validationFeedback) {
        prompt += `\n\n# Validation Feedback (fix these and re-run validation)\n${context.validationFeedback}`;
    }

    // 转义特殊字符
    const escapedPrompt = prompt
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\$/g, '\\$')
        .replace(/`/g, '\\`');

    // Codex CLI 全自动命令
    const command = `codex exec --skip-git-repo-check --yolo "${escapedPrompt}"`;

    console.log(`  → 执行: codex exec --yolo ...`);
    if (context.constraintPrompt) {
        console.log(`  → 已附加约束提示`);
    }
    if (context.validationFeedback) {
        console.log(`  → 已附加验证反馈`);
    }

    try {
        execSync(command, {
            cwd: context.projectRoot,
            stdio: 'inherit',
            timeout: 1800000
        });

        console.log('  → Codex 执行完成');
        return {};

    } catch (error) {
        context._errors = context._errors || [];
        context._errors.push({ slot: 'exec/slots/codex.js', error: error.message });

        console.log(`  → Codex 执行失败: ${error.message}`);
        return { stop: true };
    }
};
