/**
 * gen-tasks 槽位
 * 
 * 职责：为当前模块生成测试和实现任务
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async function (context) {
    const mod = context._currentModule;
    if (!mod) {
        console.log('  → 错误: 当前模块为空');
        return { stop: true };
    }

    console.log(`  → 为模块 ${mod.id} 生成任务...`);

    const splitConfig = context._splitConfig || {};
    const paths = context._paths || {};
    const templates = splitConfig.templates || {};

    // 读取提示词模板
    const templatePath = path.join(context._vaalRoot, templates.genTasks || 'split/templates/gen-tasks-prompt.md');
    if (!fs.existsSync(templatePath)) {
        console.log(`  → 错误: 模板不存在: ${templatePath}`);
        return { stop: true };
    }

    const template = fs.readFileSync(templatePath, 'utf-8');

    const moduleNumRaw = String(mod.id || '').split('-')[1];
    const moduleNum = Number.parseInt(moduleNumRaw, 10);
    const moduleIndex4 = Number.isFinite(moduleNum)
        ? String(moduleNum).padStart(4, '0')
        : String(context._currentModuleIndex + 1).padStart(4, '0');

    // 替换占位符
    const prompt = template
        .replace(/\{\{MODULE_ID\}\}/g, mod.id.toUpperCase())
        .replace(/\{\{MODULE_INDEX\}\}/g, moduleIndex4)
        .replace('{{MODULE_CONTENT}}', mod.content);

    // 将提示词写入临时文件
    const workspacePath = path.join(context._vaalRoot, '_workspace', 'split');
    const promptsDir = path.join(workspacePath, '.prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    const promptFile = path.join(promptsDir, `gen-tasks-${mod.id}-prompt.tmp.md`);
    fs.writeFileSync(promptFile, prompt, 'utf-8');

    // 输出文件
    const tasksDraftPath = path.join(context._vaalRoot, paths.tasksDraft || '_workspace/split/tasks-draft');
    const outputFile = path.join(tasksDraftPath, `${mod.id}-tasks.md`);

    // 获取 AI 工具
    const execution = splitConfig.execution || {};
    const tool = execution.tool || 'codex';

    // 构建命令
    let cmd;
    if (tool === 'codex') {
        cmd = `codex exec --skip-git-repo-check --yolo "读取 ${promptFile} 并生成任务列表，将结果写入 ${outputFile}"`;
    } else if (tool === 'claude') {
        cmd = `claude --dangerously-skip-permissions "读取 ${promptFile} 并生成任务列表，将结果写入 ${outputFile}"`;
    } else {
        cmd = tool.replace('{{PROMPT_FILE}}', promptFile).replace('{{OUTPUT_FILE}}', outputFile);
    }

    console.log(`  → 执行: ${tool} ...`);

    try {
        execSync(cmd, {
            cwd: context._projectRoot,
            stdio: 'inherit',
            timeout: 600000
        });
    } catch (error) {
        console.log(`  → 错误: AI CLI 调用失败: ${error.message}`);
        return { stop: true };
    }

    // 检查输出文件
    if (!fs.existsSync(outputFile)) {
        console.log('  → 错误: AI 未生成输出文件');
        return { stop: true };
    }

    console.log(`  → 任务草稿已保存: ${mod.id}-tasks.md`);

    return {};
};
