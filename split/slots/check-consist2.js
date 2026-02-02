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
        const tokens = tokenizeForCoverage(fp);
        const isCovered = isCoveredByTokens(tokens, storiesText);

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

function tokenizeForCoverage(text) {
    const lower = String(text || '').toLowerCase();
    const tokens = [];

    // Latin words (English/number tokens)
    const latin = lower.match(/[a-z0-9]{3,}/g) || [];
    tokens.push(...latin);

    // Chinese sequences -> bigrams to avoid "no spaces" issue
    const hanSeqs = lower.match(/[\u4e00-\u9fff]{2,}/g) || [];
    for (const seq of hanSeqs) {
        if (seq.length <= 4) {
            tokens.push(seq);
            continue;
        }
        for (let i = 0; i < seq.length - 1; i++) {
            tokens.push(seq.slice(i, i + 2));
        }
    }

    return Array.from(new Set(tokens)).filter(t => t && t.length > 1);
}

function isCoveredByTokens(tokens, haystack) {
    if (!tokens || tokens.length === 0) return false;

    // If we have Latin tokens, any hit is enough.
    const hasLatin = tokens.some(t => /[a-z0-9]/.test(t));
    if (hasLatin) {
        return tokens.some(t => t.length >= 3 && haystack.includes(t));
    }

    // For Chinese bigrams, require at least 2 hits to reduce false positives.
    let hits = 0;
    for (const t of tokens) {
        if (haystack.includes(t)) hits++;
        if (hits >= 2) return true;
    }
    return false;
}

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
