/**
 * get-design 槽位
 * 
 * 职责：读取设计文档到 context
 */

const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
    const paths = context._paths || {};
    const designPath = path.join(context._vaalRoot, paths.design || '_workspace/split/design/original.md');

    if (!fs.existsSync(designPath)) {
        console.log('  → 错误: 设计文档不存在');
        return { stop: true };
    }

    const content = fs.readFileSync(designPath, 'utf-8');

    if (!content.trim()) {
        console.log('  → 错误: 设计文档为空');
        return { stop: true };
    }

    context.designContent = content;
    console.log(`  → 已读取设计文档 (${content.length} 字符)`);

    return {};
};
