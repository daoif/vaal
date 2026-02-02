/**
 * parse-modules 槽位
 * 
 * 职责：调用 AI 将设计文档拆分为模块
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async function (context) {
    console.log('  → 正在拆分模块...');

    const splitConfig = context._splitConfig || {};
    const paths = context._paths || {};
    const templates = splitConfig.templates || {};

    // 读取提示词模板
    const templatePath = path.join(context._vaalRoot, templates.parseModules || 'split/templates/parse-modules-prompt.md');
    if (!fs.existsSync(templatePath)) {
        console.log(`  → 错误: 模板不存在: ${templatePath}`);
        return { stop: true };
    }

    const template = fs.readFileSync(templatePath, 'utf-8');

    // 替换占位符
    const prompt = template.replace('{{DESIGN_CONTENT}}', context.designContent);

    // 将提示词写入临时文件
    const workspacePath = path.join(context._vaalRoot, '_workspace', 'split');
    const promptsDir = path.join(workspacePath, '.prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    const promptFile = path.join(promptsDir, 'parse-modules-prompt.tmp.md');
    fs.writeFileSync(promptFile, prompt, 'utf-8');

    // 输出文件
    const outputFile = path.join(workspacePath, 'parse-modules-output.md');

    // 获取 AI 工具
    const execution = splitConfig.execution || {};
    const tool = execution.tool || 'codex';

    // 构建命令
    let cmd;
    if (tool === 'codex') {
        cmd = `codex exec --skip-git-repo-check --yolo "读取 ${promptFile} 并按要求拆分模块，将结果写入 ${outputFile}"`;
    } else if (tool === 'claude') {
        cmd = `claude --dangerously-skip-permissions "读取 ${promptFile} 并按要求拆分模块，将结果写入 ${outputFile}"`;
    } else {
        // 自定义命令模板，支持 {{PROMPT_FILE}} 和 {{OUTPUT_FILE}} 占位符
        cmd = tool.replace('{{PROMPT_FILE}}', promptFile).replace('{{OUTPUT_FILE}}', outputFile);
    }

    console.log(`  → 执行: ${tool} ...`);

    try {
        execSync(cmd, {
            cwd: context._projectRoot,
            stdio: 'inherit',
            timeout: 600000 // 10分钟超时
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

    // 解析输出，保存模块文件
    const output = fs.readFileSync(outputFile, 'utf-8');
    const modulesPath = path.join(context._vaalRoot, paths.modules || '_workspace/split/modules');

    // 按 # MOD- 开头分割
    const parts = output.split(/(?=^# MOD-)/m);
    let count = 0;

    for (const part of parts) {
        if (!part.trim() || !part.startsWith('# MOD-')) continue;

        const match = part.match(/^# (MOD-\d+):/m);
        if (match) {
            const modId = match[1].toLowerCase();
            const modFile = path.join(modulesPath, `${modId}.md`);
            fs.writeFileSync(modFile, part.trim(), 'utf-8');
            count++;
        }
    }

    console.log(`  → 已拆分出 ${count} 个模块文件`);

    return {};
};
