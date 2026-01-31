/**
 * VAAL 槽位脚本：初始化
 * 
 * 职责：初始化上下文，加载配置
 */

const path = require('path');

module.exports = async function (context) {
    console.log('  → 初始化上下文');

    // 配置已在调度器中加载，这里做额外初始化
    context.stats = {
        startTime: new Date().toISOString(),
        completed: 0,
        failed: 0,
        skipped: 0
    };

    // 项目根目录
    context.projectRoot = context._projectRoot;

    return {};
};
