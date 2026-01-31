/**
 * check-consist2 槽位
 * 
 * 职责：一致性检查 - 用户故事↔设计文档
 */

const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
    console.log('  → 检查用户故事与设计文档一致性...');

    const designContent = context.designContent || '';
    const userStories = context.userStories || [];

    // 从设计文档提取功能点
    const functionPoints = extractFunctionPoints(designContent);

    const report = {
        covered: [],
        missing: []
    };

    const storiesText = userStories.map(s => s.title).join(' ').toLowerCase();

    for (const fp of functionPoints) {
        const keywords = fp.toLowerCase().split(/\s+/);
        const isCovered = keywords.some(kw => kw.length > 2 && storiesText.includes(kw));

        if (isCovered) {
            report.covered.push(fp);
        } else {
            report.missing.push(fp);
        }
    }

    context.consistCheck2 = report;

    console.log(`  → 已覆盖: ${report.covered.length}, 可能缺失: ${report.missing.length}`);

    return {};
};

/**
 * 从设计文档提取功能点
 */
function extractFunctionPoints(content) {
    const points = [];

    // 匹配标题
    const headers = content.match(/^#{1,3}\s+.+$/gm) || [];
    for (const h of headers) {
        const text = h.replace(/^#+\s+/, '');
        if (text.length > 3 && text.length < 50) {
            points.push(text);
        }
    }

    return points.slice(0, 20);
}
