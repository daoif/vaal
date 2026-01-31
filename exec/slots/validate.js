/**
 * VAAL 槽位脚本：验证
 * 
 * 职责：运行测试和 lint 命令
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

module.exports = async function (context) {
    const config = context._config;
    const validation = config.validation || {};

    context.validateResult = {
        passed: true,
        details: {}
    };

    // 运行测试
    if (validation.test) {
        console.log(`  → 运行测试: ${validation.test}`);
        try {
            await execAsync(validation.test, { cwd: context.projectRoot });
            context.validateResult.details.test = 'passed';
        } catch (error) {
            context.validateResult.details.test = 'failed';
            context.validateResult.passed = false;
        }
    }

    // 运行 lint
    if (validation.lint) {
        console.log(`  → 运行 lint: ${validation.lint}`);
        try {
            await execAsync(validation.lint, { cwd: context.projectRoot });
            context.validateResult.details.lint = 'passed';
        } catch (error) {
            context.validateResult.details.lint = 'failed';
            // 检查是否是必须的
            const required = validation.required || ['test'];
            if (required.includes('lint')) {
                context.validateResult.passed = false;
            }
        }
    }

    if (!context.validateResult.passed) {
        console.log('  → 验证失败');
        context.stats.failed++;
        return { stop: config.stopOnFailure !== false };
    }

    console.log('  → 验证通过');
    return {};
};
