/**
 * load-modules 槽位
 * 
 * 职责：读取 modules/ 目录下的模块文件到 context.modules
 */

const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
    const paths = context._paths || {};
    const modulesPath = path.join(context._vaalRoot, paths.modules || '_workspace/split/modules');

    if (!fs.existsSync(modulesPath)) {
        console.log('  → 错误: 模块目录不存在');
        return { stop: true };
    }

    const files = fs.readdirSync(modulesPath)
        .filter(f => f.endsWith('.md') && f.startsWith('mod-'))
        .sort();

    if (files.length === 0) {
        console.log('  → 错误: 模块目录为空');
        return { stop: true };
    }

    context.modules = [];

    for (const file of files) {
        const filePath = path.join(modulesPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        // 提取模块 ID 和名称
        const match = content.match(/^# (MOD-\d+):\s*(.+)/m);
        if (match) {
            context.modules.push({
                id: match[1].toLowerCase(),
                name: match[2].trim(),
                file: filePath,
                content: content
            });
        }
    }

    console.log(`  → 已加载 ${context.modules.length} 个模块`);

    return {};
};
