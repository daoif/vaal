#!/usr/bin/env node

/**
 * VAAL 初始化脚本
 * 
 * 职责：创建 _workspace 目录结构，复制配置模板
 * 
 * 使用方式：node .vaal/init/scripts/setup.js
 */

const fs = require('fs');
const path = require('path');

// 查找 VAAL 根目录
const vaalRoot = path.resolve(__dirname, '../..');
const workspaceRoot = path.join(vaalRoot, '_workspace');

console.log('[VAAL] 初始化工作目录...\n');

// 需要创建的目录结构
const directories = [
    '_workspace/split/design',       // 设计文档存档目录
    '_workspace/split/modules',      // 模块文件目录
    '_workspace/split/tasks-draft',  // 任务草稿目录
    '_workspace/exec'                // 执行功能运行时目录
];

// 创建目录
for (const dir of directories) {
    const fullPath = path.join(vaalRoot, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`  ✓ 创建目录: ${dir}`);
    } else {
        console.log(`  - 目录已存在: ${dir}`);
    }
}

// 复制配置模板
const configTemplate = path.join(vaalRoot, 'init/templates/config.template.json');
const configPath = path.join(workspaceRoot, 'exec/config.json');

if (!fs.existsSync(configPath)) {
    if (fs.existsSync(configTemplate)) {
        fs.copyFileSync(configTemplate, configPath);
        console.log('  ✓ 创建配置文件: _workspace/exec/config.json');
    } else {
        console.log('  ⚠ 模板文件不存在: init/templates/config.template.json');
    }
} else {
    console.log('  - 配置文件已存在: _workspace/exec/config.json');
}

// 复制项目约束模板
const constraintTemplate = path.join(vaalRoot, 'init/templates/project-constraints.template.md');
const constraintPath = path.join(workspaceRoot, 'exec/project-constraints.md');

if (!fs.existsSync(constraintPath)) {
    if (fs.existsSync(constraintTemplate)) {
        fs.copyFileSync(constraintTemplate, constraintPath);
        console.log('  ✓ 创建项目约束: _workspace/exec/project-constraints.md');
    }
} else {
    console.log('  - 项目约束已存在: _workspace/exec/project-constraints.md');
}

// 创建空的任务列表
const tasksPath = path.join(workspaceRoot, 'exec/tasks.md');
if (!fs.existsSync(tasksPath)) {
    const tasksTemplate = `# 任务列表

## 待完成

- [ ] [IMPL-001] 示例任务（请替换为你的任务）
  
  **关联模块:** 模块名称
  
  **硬约束:**
  - 示例约束

## 已完成
<!-- 完成的任务会被移到这里 -->
`;
    fs.writeFileSync(tasksPath, tasksTemplate, 'utf-8');
    console.log('  ✓ 创建任务列表: _workspace/exec/tasks.md');
} else {
    console.log('  - 任务列表已存在: _workspace/exec/tasks.md');
}

console.log('\n[VAAL] 初始化完成！\n');
console.log('下一步：');
console.log('  1. 编辑 .vaal/_workspace/exec/config.json 配置验证命令和路径');
console.log('  2. 编辑 .vaal/_workspace/exec/project-constraints.md 设置项目约束');
console.log('  3. 编辑 .vaal/_workspace/exec/tasks.md 添加任务');
console.log('  4. 运行 node .vaal/exec/scripts/run.js 开始执行');
console.log('');
