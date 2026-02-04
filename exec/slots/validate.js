/**
 * VAAL 槽位脚本：验证
 *
 * 职责：运行测试和 lint 命令（只负责“验收”，不决定是否停止/重试）
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const DEFAULT_MAX_BUFFER = 50 * 1024 * 1024;
const DEFAULT_OUTPUT_LIMIT = 8000;

function truncate(text, limit = DEFAULT_OUTPUT_LIMIT) {
    if (!text) return '';
    const str = String(text);
    if (str.length <= limit) return str;
    return `${str.slice(0, limit)}\n... (truncated, total ${str.length} chars)`;
}

function formatValidationFeedback(validateResult) {
    if (!validateResult || validateResult.passed) return '';
    const parts = [];

    for (const key of ['test', 'lint']) {
        const detail = validateResult.details?.[key];
        if (!detail || detail.status !== 'failed') continue;

        parts.push(`## ${key.toUpperCase()} FAILED`);
        if (detail.command) parts.push(`Command:\n${detail.command}`);
        if (detail.exitCode !== undefined) parts.push(`ExitCode: ${detail.exitCode}`);
        if (detail.signal) parts.push(`Signal: ${detail.signal}`);
        if (detail.errorMessage) parts.push(`Error: ${detail.errorMessage}`);
        if (detail.stderr) parts.push(`Stderr (excerpt):\n${detail.stderr}`);
        if (detail.stdout) parts.push(`Stdout (excerpt):\n${detail.stdout}`);
        parts.push('');
    }

    return parts.join('\n');
}

async function runCommand(command, context) {
    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd: context.projectRoot,
            maxBuffer: DEFAULT_MAX_BUFFER
        });
        return {
            status: 'passed',
            command,
            stdout: truncate(stdout),
            stderr: truncate(stderr)
        };
    } catch (error) {
        return {
            status: 'failed',
            command,
            exitCode: error && typeof error.code === 'number' ? error.code : undefined,
            signal: error && error.signal ? String(error.signal) : undefined,
            errorMessage: error && error.message ? String(error.message) : 'Command failed',
            stdout: truncate(error && error.stdout),
            stderr: truncate(error && error.stderr)
        };
    }
}

module.exports = async function (context) {
    const config = context._config || {};
    const validation = config.validation || {};
    const required = validation.required || ['test'];

    context.validateResult = {
        passed: true,
        details: {}
    };

    // 运行测试
    if (validation.test) {
        console.log(`  → 运行测试: ${validation.test}`);
        context.validateResult.details.test = await runCommand(validation.test, context);
    }

    // 运行 lint
    if (validation.lint) {
        console.log(`  → 运行 lint: ${validation.lint}`);
        context.validateResult.details.lint = await runCommand(validation.lint, context);
    }

    // 计算验收是否通过（只看 required 指定的项目）
    let passed = true;
    if (required.includes('test') && validation.test) {
        passed = passed && context.validateResult.details.test?.status === 'passed';
    }
    if (required.includes('lint') && validation.lint) {
        passed = passed && context.validateResult.details.lint?.status === 'passed';
    }

    context.validateResult.passed = passed;
    context.validationFeedback = passed ? '' : formatValidationFeedback(context.validateResult);

    if (!passed) {
        const testStatus = context.validateResult.details.test?.status || 'skipped';
        const lintStatus = context.validateResult.details.lint?.status || 'skipped';
        console.log(`  → 验证失败: test=${testStatus}, lint=${lintStatus}`);
        return { validationPassed: false };
    }

    console.log('  → 验证通过');
    return { validationPassed: true };
};
