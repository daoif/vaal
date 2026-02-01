#!/usr/bin/env node

/**
 * VAAL Split - 拆分任务调度器
 * 
 * 将设计文档拆分为可执行的任务列表。
 * 
 * 使用方式：node split/scripts/run.js
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
        console.log(`[VAAL-SPLIT] 警告: 槽位脚本不存在: ${scriptPath}`);
        return {};
    }

    try {
        const handler = require(fullPath);

        if (typeof handler !== 'function') {
            console.log(`[VAAL-SPLIT] 警告: 槽位脚本未导出函数: ${scriptPath}`);
            return {};
        }

        const result = await handler(context);
        return result || {};

    } catch (error) {
        console.error(`[VAAL-SPLIT] 槽位执行错误 [${scriptPath}]: ${error.message}`);
        context._errors.push({ slot: scriptPath, error: error.message });
        return { stop: true };
    }
}

// ============================================================
// 主调度器
// ============================================================

async function main() {
    console.log('[VAAL-SPLIT] 启动拆分调度器...\n');

    // 查找 VAAL 根目录
    const vaalRoot = path.resolve(__dirname, '../..');

    // 加载配置（优先使用 _workspace/split/config.json，否则使用模板）
    const workspaceConfigPath = path.join(vaalRoot, '_workspace', 'split', 'config.json');
    const templateConfigPath = path.join(vaalRoot, 'split', 'templates', 'config.template.json');

    let config;
    if (fs.existsSync(workspaceConfigPath)) {
        config = JSON.parse(fs.readFileSync(workspaceConfigPath, 'utf-8'));
        console.log('[VAAL-SPLIT] 使用配置: _workspace/split/config.json');
    } else if (fs.existsSync(templateConfigPath)) {
        config = JSON.parse(fs.readFileSync(templateConfigPath, 'utf-8'));
        console.log('[VAAL-SPLIT] 使用模板配置: split/templates/config.template.json');
    } else {
        console.error('[VAAL-SPLIT] 错误: 找不到配置文件');
        process.exit(1);
    }

    // 确保工作目录存在
    const splitConfig = config.split || {};
    const paths = splitConfig.paths || {};
    const workspacePath = path.join(vaalRoot, '_workspace', 'split');
    const modulesPath = path.join(vaalRoot, paths.modules || '_workspace/split/modules');
    const tasksDraftPath = path.join(vaalRoot, paths.tasksDraft || '_workspace/split/tasks-draft');
    const designDir = path.dirname(path.join(vaalRoot, paths.design || '_workspace/split/design/original.md'));

    for (const dir of [workspacePath, modulesPath, tasksDraftPath, designDir]) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    // 检查设计文档是否存在
    const designPath = path.join(vaalRoot, paths.design || '_workspace/split/design/original.md');
    if (!fs.existsSync(designPath)) {
        console.error('[VAAL-SPLIT] 错误: 找不到设计文档');
        console.error(`[VAAL-SPLIT] 请先将设计文档保存到: ${designPath}`);
        console.error('[VAAL-SPLIT] 或者对 AI 说"帮我拆分任务"，让 AI 引导你完成准备工作。');
        process.exit(1);
    }

    // 初始化共享上下文
    const context = {
        _vaalRoot: vaalRoot,
        _projectRoot: path.dirname(vaalRoot),
        _config: config,
        _splitConfig: splitConfig,
        _paths: paths,
        _errors: [],
        hasMore: true,
        modules: [],
    };

    // 获取 pipeline 和 slots
    const pipeline = config.pipeline || {
        global: ['getDesign', 'parseModules', 'loadModules'],
        loop: ['genTasks', 'validateFormat'],
        finally: ['mergeTasks', 'sortDeps', 'checkConsist1', 'genUserStories', 'checkConsist2', 'report']
    };

    const defaultSlots = {
        getDesign: 'split/slots/get-design.js',
        parseModules: 'split/slots/parse-modules.js',
        loadModules: 'split/slots/load-modules.js',
        genTasks: 'split/slots/gen-tasks.js',
        validateFormat: 'split/slots/validate-format.js',
        mergeTasks: 'split/slots/merge-tasks.js',
        sortDeps: 'split/slots/sort-deps.js',
        checkConsist1: 'split/slots/check-consist1.js',
        genUserStories: 'split/slots/gen-user-stories.js',
        checkConsist2: 'split/slots/check-consist2.js',
        report: 'split/slots/report.js'
    };
    const slots = { ...defaultSlots, ...(config.slots || {}) };

    // ========== 全局阶段 ==========
    console.log('[VAAL-SPLIT] === 全局阶段 ===');
    for (const slotName of pipeline.global || []) {
        console.log(`[VAAL-SPLIT] 调用槽位: ${slotName}`);
        const result = await callSlot(slots[slotName], context);
        if (result.stop) {
            console.log('[VAAL-SPLIT] 全局阶段中止');
            return;
        }
    }

    // ========== 循环阶段（为每个模块生成任务）==========
    console.log('\n[VAAL-SPLIT] === 循环阶段 ===');
    console.log(`[VAAL-SPLIT] 共有 ${context.modules.length} 个模块需要处理`);

    for (let i = 0; i < context.modules.length; i++) {
        const mod = context.modules[i];
        context._currentModule = mod;
        context._currentModuleIndex = i;

        console.log(`\n[VAAL-SPLIT] --- 处理模块 ${i + 1}/${context.modules.length}: ${mod.id || mod.name} ---`);

        for (const slotName of pipeline.loop || []) {
            console.log(`[VAAL-SPLIT] 调用槽位: ${slotName}`);
            const result = await callSlot(slots[slotName], context);
            if (result.stop) {
                console.log('[VAAL-SPLIT] 循环阶段中止');
                return;
            }
            if (result.break) {
                break;
            }
        }
    }

    // ========== 结束阶段 ==========
    console.log('\n[VAAL-SPLIT] === 结束阶段 ===');
    for (const slotName of pipeline.finally || []) {
        console.log(`[VAAL-SPLIT] 调用槽位: ${slotName}`);
        const result = await callSlot(slots[slotName], context);
        if (result.stop) {
            console.log(`[VAAL-SPLIT] ${slotName} 阶段发生错误`);
            break;
        }
    }

    console.log('\n[VAAL-SPLIT] 拆分完成');
    console.log('[VAAL-SPLIT] 请查看:');
    console.log(`  - 报告: ${path.join(vaalRoot, paths.report || '_workspace/split/report.md')}`);
    console.log(`  - 任务: ${path.join(vaalRoot, paths.tasksOutput || '_workspace/exec/tasks.md')}`);
}

// 执行
main().catch(error => {
    console.error('[VAAL-SPLIT] 致命错误:', error.message);
    process.exit(1);
});
