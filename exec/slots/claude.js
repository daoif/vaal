/**
 * VAAL 槽位脚本：调用 Claude CLI
 * 
 * 职责：使用 Claude CLI 执行任务
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
    if (context.validationFeedback) {
        prompt += `\n\n# Validation Feedback (fix these and re-run validation)\n${context.validationFeedback}`;
    }

    // 转义特殊字符
    const escapedPrompt = prompt
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\$/g, '\\$')
        .replace(/`/g, '\\`');

    // Claude CLI 全自动命令
    const command = `claude --dangerously-skip-permissions "${escapedPrompt}"`;

    console.log(`  → 执行: claude --dangerously-skip-permissions ...`);
    if (context.constraintPrompt) {
        console.log(`  → 已附加约束提示`);
    }
    if (context.validationFeedback) {
        console.log(`  → 已附加验证反馈`);
    }

    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd: context.projectRoot,
            timeout: 1800000,
            maxBuffer: 50 * 1024 * 1024
        });

        context.aiResult = {
            success: true,
            stdout,
            stderr
        };

        console.log('  → Claude 执行完成');
        return {};

    } catch (error) {
        context.aiResult = {
            success: false,
            error: error.message
        };

        console.log(`  → Claude 执行失败: ${error.message}`);
        return { stop: true };
    }
};
