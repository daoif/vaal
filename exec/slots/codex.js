/**
 * VAAL 槽位脚本：调用 Codex CLI
 * 
 * 职责：使用 Codex CLI 执行任务
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

module.exports = async function (context) {
    const task = context.currentTask;
    if (!task) return {};

    // 组合任务描述和约束提示
    let prompt = task.task;
    if (context.constraintPrompt) {
        prompt += context.constraintPrompt;
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

    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd: context.projectRoot,
            timeout: 600000,
            maxBuffer: 50 * 1024 * 1024
        });

        context.aiResult = {
            success: true,
            stdout,
            stderr
        };

        console.log('  → Codex 执行完成');
        return {};

    } catch (error) {
        context.aiResult = {
            success: false,
            error: error.message
        };

        console.log(`  → Codex 执行失败: ${error.message}`);
        return { stop: true };
    }
};
