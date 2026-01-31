/**
 * VAAL 槽位脚本：生成报告
 * 
 * 职责：输出执行统计
 */

module.exports = async function (context) {
    const stats = context.stats || {};

    console.log('\n========================================');
    console.log('           执行报告');
    console.log('========================================');
    console.log(`开始时间: ${stats.startTime}`);
    console.log(`结束时间: ${new Date().toISOString()}`);
    console.log(`已完成: ${stats.completed || 0}`);
    console.log(`失败: ${stats.failed || 0}`);
    console.log(`跳过: ${stats.skipped || 0}`);

    if (context._errors && context._errors.length > 0) {
        console.log('\n错误列表:');
        for (const err of context._errors) {
            console.log(`  - ${err.slot}: ${err.error}`);
        }
    }

    console.log('========================================\n');

    return {};
};
