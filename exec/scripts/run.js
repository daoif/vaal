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

    // 检查 _workspace/config.json 是否存在
    const configPath = path.join(vaalRoot, '_workspace', 'config.json');
    if (!fs.existsSync(configPath)) {
        console.error('[VAAL] 错误: 找不到 _workspace/config.json');
        console.error('[VAAL] 请先运行初始化流程');
        process.exit(1);
    }

    // 加载配置
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // 初始化共享上下文
    const context = {
        _vaalRoot: vaalRoot,
        _projectRoot: path.dirname(vaalRoot),
        _config: config,
        _errors: [],
        hasMore: true,  // 循环控制标志
    };

    // 获取 pipeline 和 slots
    const pipeline = config.pipeline || {
        global: ['init', 'loadTasks'],
        loop: ['readNext', 'execute', 'validate', 'git', 'markDone'],
        finally: ['report']
    };
    const slots = config.slots || {};

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
            const result = await callSlot(slots[slotName], context);

            if (result.break) {
                console.log('[VAAL] 跳出当前迭代');
                break;
            }
            if (result.stop) {
                console.log('[VAAL] 停止循环');
                context.hasMore = false;
                break;
            }
        }
    }

    if (iteration >= maxIterations) {
        console.log(`\n[VAAL] 达到最大迭代次数: ${maxIterations}`);
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
