#!/usr/bin/env node

/**
 * VAAL - 槽位调度器
 * 
 * 这是一个纯调度器，不包含任何业务逻辑。
 * 所有功能通过配置中的槽位脚本实现。
 * 
 * 使用方式：node run.js
 */

const path = require('path');
const fs = require('fs');

function firstNonEmptyLine(text) {
    if (!text) return '';
    const lines = String(text).split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) return trimmed;
    }
    return '';
}

function summarizeValidationFailure(validateResult) {
    if (!validateResult || validateResult.passed) return '';

    const parts = [];
    const test = validateResult.details && validateResult.details.test;
    const lint = validateResult.details && validateResult.details.lint;

    if (test && test.status === 'failed') {
        parts.push(`test: ${firstNonEmptyLine(test.stderr) || firstNonEmptyLine(test.stdout) || test.errorMessage || 'failed'}`);
    }
    if (lint && lint.status === 'failed') {
        parts.push(`lint: ${firstNonEmptyLine(lint.stderr) || firstNonEmptyLine(lint.stdout) || lint.errorMessage || 'failed'}`);
    }

    return parts.join(' | ');
}

// ============================================================
// 核心：槽位调用
// ============================================================

/**
 * 调用槽位脚本
 * @param {string} scriptPath - 脚本路径（相对于 VAAL 根目录）
 * @param {Object} context - 共享上下文
 * @returns {Object} 脚本返回的控制指令
 */
async function callSlot(scriptPath, context) {
    if (!scriptPath) {
        return {};
    }

    const fullPath = path.resolve(context._vaalRoot, scriptPath);

    if (!fs.existsSync(fullPath)) {
        console.log(`[VAAL] 警告: 槽位脚本不存在: ${scriptPath}`);
        return {};
    }

    try {
        const handler = require(fullPath);

        if (typeof handler !== 'function') {
            console.log(`[VAAL] 警告: 槽位脚本未导出函数: ${scriptPath}`);
            return {};
        }

        const result = await handler(context);
        return result || {};

    } catch (error) {
        console.error(`[VAAL] 槽位执行错误 [${scriptPath}]: ${error.message}`);
        context._errors.push({ slot: scriptPath, error: error.message });
        return { stop: true };
    }
}

// ============================================================
// 主调度器
// ============================================================

async function main() {
    console.log('[VAAL] 启动槽位调度器...\n');

    // 查找 VAAL 根目录（包含 exec 目录的目录）
    let vaalRoot = path.resolve(__dirname, '../..');

    // 检查 _workspace/exec/config.json 是否存在
    const configPath = path.join(vaalRoot, '_workspace', 'exec', 'config.json');
    if (!fs.existsSync(configPath)) {
        console.error('[VAAL] 错误: 找不到 _workspace/exec/config.json');
        console.error('[VAAL] 请先运行: node .vaal/init/scripts/setup.js');
        process.exit(1);
    }

    // 加载配置
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    const validationConfig = config.validation || {};
    const repairConfig = validationConfig.repair || {};
    const repairEnabled = repairConfig.enabled !== false;
    const repairMaxAttempts = Number.isInteger(repairConfig.maxAttempts) ? repairConfig.maxAttempts : 3;
    const stopOnFailure = config.stopOnFailure !== false;

    // 初始化共享上下文
    const context = {
        _vaalRoot: vaalRoot,
        _projectRoot: path.dirname(vaalRoot),
        _config: config,
        _errors: [],
        hasMore: true,  // 循环控制标志
        stopped: false
    };

    // 获取 pipeline 和 slots
    const pipeline = config.pipeline || {
        global: ['init', 'loadTasks'],
        loop: ['readNext', 'loadConstraints', 'execute', 'validate', 'git', 'markDone'],
        finally: ['report']
    };

    // 默认槽位映射（用户可在 config.json 中覆盖）
    const defaultSlots = {
        init: 'exec/slots/init.js',
        loadTasks: 'exec/slots/load-tasks.js',
        readNext: 'exec/slots/read-next.js',
        loadConstraints: 'exec/slots/load-constraints.js',
        execute: 'exec/slots/codex.js',
        validate: 'exec/slots/validate.js',
        git: 'exec/slots/git.js',
        markDone: 'exec/slots/mark-done.js',
        report: 'exec/slots/report.js'
    };
    const slots = { ...defaultSlots, ...(config.slots || {}) };

    // ========== 全局阶段 ==========
    console.log('[VAAL] === 全局阶段 ===');
    for (const slotName of pipeline.global || []) {
        console.log(`[VAAL] 调用槽位: ${slotName}`);
        const result = await callSlot(slots[slotName], context);
        if (result.stop) {
            console.log('[VAAL] 全局阶段中止');
            return;
        }
    }

    // ========== 循环阶段 ==========
    console.log('\n[VAAL] === 循环阶段 ===');
    let iteration = 0;
    const maxIterations = config.maxIterations || 100;

    while (context.hasMore && iteration < maxIterations) {
        iteration++;
        console.log(`\n[VAAL] --- 迭代 ${iteration} ---`);

        for (const slotName of pipeline.loop || []) {
            console.log(`[VAAL] 调用槽位: ${slotName}`);

            // 统一：每次选出新任务时，重置本轮“修复上下文”
            if (slotName === 'readNext') {
                const result = await callSlot(slots[slotName], context);
                if (result.break || result.stop) {
                    if (result.break) {
                        console.log('[VAAL] 跳出当前迭代');
                        break;
                    }
                    if (result.stop) {
                        console.log('[VAAL] 停止循环');
                        context.stopped = true;
                        context.hasMore = false;
                        break;
                    }
                }

                if (context.currentTask) {
                    context.validationFeedback = '';
                    context.validateResult = null;
                    context.currentTask._executeAttempts = 0;
                }
                continue;
            }

            // execute：记录本任务执行尝试次数（用于修复重试）
            if (slotName === 'execute' && context.currentTask) {
                context.currentTask._executeAttempts = (context.currentTask._executeAttempts || 0) + 1;
                if (context.currentTask._executeAttempts > 1) {
                    console.log(
                        `  → 自动修复：第 ${context.currentTask._executeAttempts}/${repairMaxAttempts} 次执行尝试`
                    );
                }
            }

            const result = await callSlot(slots[slotName], context);

            // validate：失败时自动回调 execute 做修复，再次 validate
            if (slotName === 'validate') {
                const validationPassed = result.validationPassed ?? context.validateResult?.passed ?? true;

                if (!validationPassed) {
                    const task = context.currentTask;
                    const attempts = task ? task._executeAttempts || 0 : 0;

                    if (!repairEnabled || !task) {
                        console.log('[VAAL] 验证未通过，未启用自动修复');
                    } else if (attempts >= repairMaxAttempts) {
                        console.log(`[VAAL] 验证未通过，已达到最大修复次数: ${repairMaxAttempts}`);
                    } else {
                        // 从“当前状态”开始修复：重复 execute → validate，直到通过或达到上限
                        let passed = false;
                        while (task._executeAttempts < repairMaxAttempts) {
                            console.log(`[VAAL] 验证未通过，开始自动修复（${task._executeAttempts + 1}/${repairMaxAttempts}）`);

                            // 再次 execute（携带 validationFeedback 给 AI）
                            task._executeAttempts = (task._executeAttempts || 0) + 1;
                            const execResult = await callSlot(slots.execute, context);
                            if (execResult.stop) {
                                console.log('[VAAL] 停止循环');
                                context.stopped = true;
                                context.hasMore = false;
                                break;
                            }

                            // 再次 validate
                            const validateResult = await callSlot(slots.validate, context);
                            passed = validateResult.validationPassed ?? context.validateResult?.passed ?? false;
                            if (passed) break;
                        }

                        if (passed) {
                            context.validationFeedback = '';
                            continue;
                        }
                    }

                    // 到这里代表：验证最终仍失败（或没启用修复）
                    const taskId = task ? task.id : '(unknown)';
                    const taskName = task ? task.task.substring(0, 40) : 'unknown task';
                    const endTime = new Date();
                    const startTime = (task && task._startTime) ? task._startTime : endTime;
                    const durationMs = endTime - startTime;
                    const validationSummary = summarizeValidationFailure(context.validateResult);

                    context.stats.failed++;
                    context.taskRecords = context.taskRecords || [];
                    context.taskRecords.push({
                        time: endTime.toTimeString().split(' ')[0],
                        taskId,
                        taskName,
                        status: '❌ 失败',
                        duration: `${Math.round(durationMs / 1000)}s`,
                        note: validationSummary || 'validation failed'
                    });

                    context._errors = context._errors || [];
                    context._errors.push({
                        slot: 'exec/slots/validate.js',
                        error: validationSummary
                            ? `Task ${taskId}: ${validationSummary}`
                            : `Validation failed for task ${taskId}`
                    });

                    context.validationFailures = context.validationFailures || [];
                    context.validationFailures.push({
                        taskId,
                        taskName,
                        attempts: task ? task._executeAttempts || 0 : 0,
                        feedback: context.validationFeedback || ''
                    });

                    if (task) task.status = 'failed';

                    if (stopOnFailure) {
                        console.log('[VAAL] 停止循环');
                        context.stopped = true;
                        context.hasMore = false;
                    } else {
                        console.log('[VAAL] 当前任务验证失败，继续下一个任务');
                        context.currentTask = null;
                    }

                    break;
                }

                // 通过：避免把上一次失败的反馈带到后续任务
                context.validationFeedback = '';
            }

            if (result.break) {
                console.log('[VAAL] 跳出当前迭代');
                break;
            }
            if (result.stop) {
                console.log('[VAAL] 停止循环');
                context.stopped = true;
                context.hasMore = false;
                break;
            }
        }
    }

    if (iteration >= maxIterations) {
        console.log(`\n[VAAL] 达到最大迭代次数: ${maxIterations}`);
        context.stopped = true;
    }

    // ========== 结束阶段 ==========
    console.log('\n[VAAL] === 结束阶段 ===');
    for (const slotName of pipeline.finally || []) {
        console.log(`[VAAL] 调用槽位: ${slotName}`);
        await callSlot(slots[slotName], context);
    }

    console.log('\n[VAAL] 调度完成');
}

// 执行
main().catch(error => {
    console.error('[VAAL] 致命错误:', error.message);
    process.exit(1);
});
