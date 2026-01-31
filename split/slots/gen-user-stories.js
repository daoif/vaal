/**
 * gen-user-stories 槽位
 * 
 * 职责：从模块生成用户故事
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async function (context) {
    console.log('  → 生成用户故事...');

    const modules = context.modules || [];
    if (modules.length === 0) {
        console.log('  → 没有模块，跳过');
        return {};
    }

    const splitConfig = context._splitConfig || {};
    const paths = context._paths || {};
    const templates = splitConfig.templates || {};

    // 构建模块摘要
    let modulesSummary = '';
    for (const mod of modules) {
        modulesSummary += `\n## ${mod.id.toUpperCase()}: ${mod.name}\n`;

        // 提取概述
        const overviewMatch = mod.content.match(/## 概述\s*\n([\s\S]*?)(?=\n##|$)/);
        if (overviewMatch) {
            modulesSummary += overviewMatch[1].trim() + '\n';
        }
    }

    // 读取提示词模板
    const templatePath = path.join(context._vaalRoot, templates.genUserStories || 'split/templates/gen-user-stories-prompt.md');
    if (!fs.existsSync(templatePath)) {
        console.log('  → 警告: 模板不存在，跳过用户故事生成');
        return {};
    }

    const template = fs.readFileSync(templatePath, 'utf-8');
    const prompt = template.replace('{{MODULES_SUMMARY}}', modulesSummary);

    const workspacePath = path.join(context._vaalRoot, '_workspace', 'split');
    const promptFile = path.join(workspacePath, 'user-stories-prompt.tmp.md');
    fs.writeFileSync(promptFile, prompt, 'utf-8');

    const outputFile = path.join(context._vaalRoot, paths.userStories || '_workspace/split/user-stories.md');

    // 获取 AI 工具
    const execution = splitConfig.execution || {};
    const tool = execution.tool || 'codex';

    let cmd;
    if (tool === 'codex') {
        cmd = `codex exec --skip-git-repo-check --yolo "读取 ${promptFile} 并生成用户故事，将结果写入 ${outputFile}"`;
    } else if (tool === 'claude') {
        cmd = `claude --dangerously-skip-permissions "读取 ${promptFile} 并生成用户故事，将结果写入 ${outputFile}"`;
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
        console.log(`  → 警告: 用户故事生成失败: ${error.message}`);
        return {};
    }

    // 解析用户故事
    if (fs.existsSync(outputFile)) {
        const content = fs.readFileSync(outputFile, 'utf-8');
        const matches = content.matchAll(/### (US-\d+):\s*(.+)/g);
        context.userStories = Array.from(matches, m => ({ id: m[1], title: m[2] }));
        console.log(`  → 生成了 ${context.userStories.length} 个用户故事`);
    }

    return {};
};
