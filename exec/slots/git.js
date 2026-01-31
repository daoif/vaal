/**
 * VAAL 槽位脚本：Git 操作
 * 
 * 职责：提交代码变更
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

module.exports = async function (context) {
    const config = context._config;
    const git = config.git || {};

    if (!git.autoCommit) {
        console.log('  → Git 自动提交已禁用');
        return {};
    }

    const task = context.currentTask;
    if (!task) return {};

    try {
        // 检查是否有变更
        const { stdout: status } = await execAsync('git status --porcelain', {
            cwd: context.projectRoot
        });

        if (!status.trim()) {
            console.log('  → 没有需要提交的变更');
            return {};
        }

        // Stage all
        await execAsync('git add -A', { cwd: context.projectRoot });

        // 构建提交信息
        let message;
        const style = git.commitStyle || 'simple';
        const taskDesc = task.task.substring(0, 50);

        if (style === 'conventional') {
            message = `feat(auto): ${taskDesc}`;
        } else {
            message = `auto: ${taskDesc}`;
        }

        // Commit
        await execAsync(`git commit -m "${message}"`, { cwd: context.projectRoot });
        console.log(`  → 已提交: ${message}`);

        // Push
        if (git.autoPush) {
            await execAsync('git push', { cwd: context.projectRoot });
            console.log('  → 已推送');
        }

        return {};

    } catch (error) {
        console.log(`  → Git 操作失败: ${error.message}`);
        return {};
    }
};
