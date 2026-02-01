#!/usr/bin/env node

/**
 * VAAL 初始化脚本
 * 
 * 职责：
 * 1. 探查仓库状态
 * 2. 创建 _workspace 目录结构
 * 3. 根据探查结果生成适配的配置
 * 
 * 使用方式：node .vaal/init/scripts/setup.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 查找 VAAL 根目录和项目根目录
const vaalRoot = path.resolve(__dirname, '../..');
const projectRoot = path.resolve(vaalRoot, '..');
const workspaceRoot = path.join(vaalRoot, '_workspace');

console.log('[VAAL] 初始化工作目录...\n');

// ============================================================
// Step 1: 仓库探查
// ============================================================

console.log('📂 探查仓库状态...\n');

const probe = {
    // 基础信息
    hasGit: fs.existsSync(path.join(projectRoot, '.git')),
    files: [],
    
    // 技术栈
    techStack: null,
    packageJson: null,
    
    // 约束文件
    agentsFile: null,
    
    // 源码
    hasSrcDir: false,
    hasDocsDir: false,
    
    // Git 历史
    hasCommits: false,
    
    // 仓库类型
    repoType: 'A' // 默认空仓库
};

// 探查根目录文件
try {
    probe.files = fs.readdirSync(projectRoot).filter(f => !f.startsWith('.'));
} catch (e) {
    probe.files = [];
}

// 探查 package.json
const packageJsonPath = path.join(projectRoot, 'package.json');
if (fs.existsSync(packageJsonPath)) {
    try {
        probe.packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        probe.techStack = 'nodejs';
    } catch (e) {
        // 解析失败
    }
}

// 探查其他技术栈
if (!probe.techStack) {
    if (fs.existsSync(path.join(projectRoot, 'pyproject.toml')) || 
        fs.existsSync(path.join(projectRoot, 'requirements.txt'))) {
        probe.techStack = 'python';
    } else if (fs.existsSync(path.join(projectRoot, 'go.mod'))) {
        probe.techStack = 'go';
    } else if (fs.existsSync(path.join(projectRoot, 'Cargo.toml'))) {
        probe.techStack = 'rust';
    }
}

// 探查约束文件
const agentFiles = ['AGENTS.md', 'CLAUDE.md', '.cursorrules'];
for (const file of agentFiles) {
    if (fs.existsSync(path.join(projectRoot, file))) {
        probe.agentsFile = file;
        break;
    }
}

// 探查目录结构
probe.hasSrcDir = fs.existsSync(path.join(projectRoot, 'src')) || 
                   fs.existsSync(path.join(projectRoot, 'app'));
probe.hasDocsDir = fs.existsSync(path.join(projectRoot, 'docs'));

// 探查 Git 历史
if (probe.hasGit) {
    try {
        const log = execSync('git log --oneline -1', { 
            cwd: projectRoot, 
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        probe.hasCommits = log.trim().length > 0;
    } catch (e) {
        probe.hasCommits = false;
    }
}

// 判断仓库类型
if (probe.files.length === 0 || (probe.files.length === 1 && probe.files[0] === 'README.md')) {
    probe.repoType = 'A'; // 空仓库
} else if (probe.hasDocsDir && !probe.hasSrcDir && !probe.packageJson) {
    probe.repoType = 'B'; // 文档阶段
} else if (probe.packageJson && !probe.hasCommits) {
    probe.repoType = 'C'; // 骨架阶段
} else if (probe.hasCommits) {
    probe.repoType = 'D'; // 开发中
} else {
    probe.repoType = 'C'; // 默认骨架阶段
}

// 输出探查结果
const repoTypeNames = {
    'A': '空仓库',
    'B': '文档阶段',
    'C': '骨架阶段',
    'D': '开发中'
};

console.log('┌────────────────────────────────────────┐');
console.log('│           🔍 仓库探查结果               │');
console.log('├────────────────────────────────────────┤');
console.log(`│ 仓库类型: Type ${probe.repoType} - ${repoTypeNames[probe.repoType].padEnd(20)}│`);
console.log(`│ 技术栈: ${(probe.techStack || '未检测到').padEnd(30)}│`);
console.log(`│ Git 仓库: ${(probe.hasGit ? '是' : '否').padEnd(28)}│`);
console.log(`│ 有提交历史: ${(probe.hasCommits ? '是' : '否').padEnd(26)}│`);
console.log(`│ 约束文件: ${(probe.agentsFile || '未检测到').padEnd(28)}│`);
console.log('└────────────────────────────────────────┘');
console.log('');

// ============================================================
// Step 2: 创建目录结构
// ============================================================

console.log('📁 创建目录结构...\n');

const directories = [
    '_workspace/split/design',
    '_workspace/split/modules',
    '_workspace/split/tasks-draft',
    '_workspace/exec'
];

for (const dir of directories) {
    const fullPath = path.join(vaalRoot, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`  ✓ 创建目录: ${dir}`);
    } else {
        console.log(`  - 目录已存在: ${dir}`);
    }
}

// ============================================================
// Step 3: 生成配置文件（根据探查结果）
// ============================================================

console.log('\n📝 生成配置文件...\n');

// 构建配置
const config = {
    pipeline: {
        global: ['init', 'loadTasks'],
        loop: ['readNext', 'loadConstraints', 'execute', 'validate', 'git', 'markDone'],
        finally: ['report']
    },
    slots: {
        init: 'exec/slots/init.js',
        loadTasks: 'exec/slots/load-tasks.js',
        readNext: 'exec/slots/read-next.js',
        loadConstraints: 'exec/slots/load-constraints.js',
        execute: 'exec/slots/codex.js', // 默认 codex，用户可改 claude
        validate: 'exec/slots/validate.js',
        git: 'exec/slots/git.js',
        markDone: 'exec/slots/mark-done.js',
        report: 'exec/slots/report.js'
    },
    paths: {
        tasks: '_workspace/exec/tasks.md',
        progress: '_workspace/exec/progress.txt',
        projectConstraints: '_workspace/exec/project-constraints.md',
        moduleConstraints: '_workspace/split/design/modules'
    },
    validation: {
        test: 'npm test',
        lint: 'npm run lint',
        required: ['test']
    },
    git: {
        autoCommit: true,
        autoPush: false,
        commitStyle: 'conventional'
    },
    maxIterations: 50,
    // 保存探查结果供 AI 参考
    _probe: {
        repoType: probe.repoType,
        techStack: probe.techStack,
        agentsFile: probe.agentsFile
    }
};

// 根据探查结果调整配置
if (probe.packageJson?.scripts) {
    if (probe.packageJson.scripts.test) {
        config.validation.test = 'npm test';
    }
    if (probe.packageJson.scripts.lint) {
        config.validation.lint = 'npm run lint';
    }
}

if (probe.techStack === 'python') {
    config.validation.test = 'pytest';
    config.validation.lint = 'ruff check .';
} else if (probe.techStack === 'go') {
    config.validation.test = 'go test ./...';
    config.validation.lint = 'golangci-lint run';
} else if (probe.techStack === 'rust') {
    config.validation.test = 'cargo test';
    config.validation.lint = 'cargo clippy';
}

// 如果检测到约束文件，使用它
if (probe.agentsFile) {
    config.paths.projectConstraints = `../${probe.agentsFile}`;
}

// 写入配置
const configPath = path.join(workspaceRoot, 'exec/config.json');
if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf-8');
    console.log('  ✓ 创建配置文件: _workspace/exec/config.json');
} else {
    console.log('  - 配置文件已存在: _workspace/exec/config.json');
}

// 复制项目约束模板（仅当未使用外部约束文件时）
const constraintTemplate = path.join(vaalRoot, 'init/templates/project-constraints.template.md');
const constraintPath = path.join(workspaceRoot, 'exec/project-constraints.md');

if (!probe.agentsFile && !fs.existsSync(constraintPath)) {
    if (fs.existsSync(constraintTemplate)) {
        fs.copyFileSync(constraintTemplate, constraintPath);
        console.log('  ✓ 创建项目约束: _workspace/exec/project-constraints.md');
    }
} else if (probe.agentsFile) {
    console.log(`  - 使用外部约束文件: ${probe.agentsFile}`);
}

// 创建任务列表
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

// ============================================================
// Step 4: 输出下一步建议
// ============================================================

console.log('\n[VAAL] ✅ 初始化完成！\n');

// 根据仓库类型给出不同建议
if (probe.repoType === 'A') {
    console.log('检测到这是一个空仓库。建议：');
    console.log('  1. 先初始化项目骨架');
    console.log('  2. 创建设计文档');
    console.log('  3. 使用 VAAL 拆分任务');
} else if (probe.repoType === 'B') {
    console.log('检测到项目有文档但无代码。建议：');
    console.log('  1. 对 AI 说"帮我拆分任务"');
    console.log('  2. 或手动编辑 .vaal/_workspace/exec/tasks.md');
} else {
    console.log('下一步：');
    console.log('  1. 编辑 .vaal/_workspace/exec/tasks.md 添加任务');
    console.log('  2. 运行 node .vaal/exec/scripts/run.js 开始执行');
}

console.log('\n如需修改配置，编辑 .vaal/_workspace/exec/config.json');
console.log('');
