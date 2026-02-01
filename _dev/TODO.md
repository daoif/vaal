# VAAL 待办事项

> 本文档记录项目中**已确认存在**的问题，按模块分类整理。
>
> 每个问题都标注了**现象**、**定位**、**影响**三要素，方便后续修复。

---

## 一、Init 模块（初始化）

### 1.1 模块约束目录不一致

**问题描述：**  
`init/scripts/setup.js` 创建的目录列表里没有 `_workspace/split/design/modules`，但 `config.json` 中 `paths.moduleConstraints` 的默认值指向这里。虽然目录在首次加载时可能会被自动创建，但如果 exec 模块先运行，会找不到目录。

**定位：**  
- `init/scripts/setup.js` 第 150-155 行：目录列表
- 生成的 `config.json` 第 195 行：`moduleConstraints: '_workspace/split/design/modules'`

**影响：** 低（exec 运行时可能报目录不存在的警告）

---

### 1.2 split 产物目录与 exec 读取目录不匹配

**问题描述：**  
split 模块生成模块文件到 `_workspace/split/modules/`（如 `mod-001.md`），但 exec 模块默认从 `_workspace/split/design/modules/` 读取模块约束。两边路径不统一。

**定位：**  
- `split/slots/parse-modules.js` 第 74 行：输出到 `paths.modules || '_workspace/split/modules'`
- `exec/slots/load-constraints.js` 第 140-142 行：读取 `paths.moduleConstraints || '_workspace/split/design/modules'`

**影响：** 中（用户需手动移动文件或修改配置，否则模块约束无法加载）

**建议：** 统一为 `_workspace/split/modules`，或提供配置指引

---

### 1.3 配置更新不具幂等性

**问题描述：**  
`setup.js` 只在 `config.json` 不存在时创建，若已存在则跳过。这导致旧配置中遗留的字段（如已废弃的 `taskPath`）无法自动清理，新增字段也不会补充。

**定位：**  
- `init/scripts/setup.js` 第 244-249 行：`if (!fs.existsSync(configPath))` 判断

**影响：** 中（用户升级 VAAL 后可能需要手动更新配置）

---

### 1.4 Type A/B 仓库的验证命令默认值不合理

**问题描述：**  
对于空仓库或纯文档仓库，仍默认生成 `validation.test = 'npm test'`。这类项目根本没有测试脚本，exec 运行时必然失败。

**定位：**  
- `init/scripts/setup.js` 第 197-200 行：硬编码的默认验证配置

**影响：** 中（用户需手动修改配置，否则任务执行会失败）

---

## 二、Split 模块（拆分）

### 2.1 `--finalize` 参数未实现

**问题描述：**  
`DESIGN.md` 流程图（第 110 行）提到"用户执行 `--finalize` 生成最终 tasks.md"，但 `split/scripts/run.js` 没有实现这个参数分支。实际上 `report.js` 槽位会直接生成 tasks.md，无需二次确认。

**定位：**  
- `_dev/DESIGN.md` 第 110 行：`node .vaal/split/scripts/run.js --finalize`
- `split/scripts/run.js`：无 `--finalize` 相关代码

**影响：** 低（文档与实现不一致，但不影响功能）

**建议：** 更新文档，移除 `--finalize` 描述，改为说明任务列表直接输出

---

### 2.2 关联模块字段与约束文件命名关系不明

**问题描述：**  
task 的"关联模块"字段值（如 `MOD-001`）与模块约束文件名（如 `mod-001.md`）之间的映射规则不清晰。`load-constraints.js` 尝试多种命名变体，但没有文档说明规范。

**定位：**  
- `split/templates/gen-tasks-prompt.md`：生成任务时填 `{{MODULE_ID}}`
- `exec/slots/load-constraints.js` 第 145-149 行：尝试 `moduleName.md`、`moduleName.toLowerCase().md` 等变体

**影响：** 低（目前能工作，但不规范可能导致未来问题）

---

## 三、Exec 模块（执行）

### 3.1 依赖未满足时任务原地打转

**问题描述：**  
当 `loadConstraints` 检测到依赖未完成时返回 `{ break: true }`，跳出本次迭代。但任务状态仍是 `pending`，下次迭代 `readNext` 又会选中同一个任务，陷入死循环直到达到 maxIterations。

**定位：**  
- `exec/slots/load-constraints.js` 第 197 行：`return { break: true }`
- `exec/slots/read-next.js` 第 11 行：始终选第一个 `pending` 任务
- `exec/scripts/run.js` 第 130-133 行：`break` 只跳出当前迭代，循环继续

**影响：** 高（依赖链复杂时可能导致无限循环）

**建议：** 
1. 跳过任务时标记 `skipped` 状态，下次不再选中
2. 或按依赖顺序排序任务列表

---

### 3.2 Git commit hash 未保存到上下文

**问题描述：**  
`mark-done.js` 在记录任务时读取 `context.lastCommitHash`，但 `git.js` 提交后没有保存 commit hash 到 context。导致 progress.txt 中的备注栏始终为空。

**定位：**  
- `exec/slots/git.js`：提交成功后没有设置 `context.lastCommitHash`
- `exec/slots/mark-done.js` 第 31 行：`note: context.lastCommitHash ? ...`

**影响：** 低（progress.txt 中缺少 commit 关联信息）

**修复：** 在 `git.js` 提交成功后添加：
```javascript
const { stdout } = await execAsync('git rev-parse --short HEAD', { cwd: context._projectRoot });
context.lastCommitHash = stdout.trim();
```

---

### 3.3 执行状态判断字段不存在

**问题描述：**  
`exec/slots/report.js` 使用 `context.stopped` 判断是"执行中断"还是"执行完成"，但调度器 `run.js` 从未设置这个字段。导致状态判断不准确。

**定位：**  
- `exec/slots/report.js` 第 82 行：`context.stopped ? '执行中断' : '执行完成'`
- `exec/scripts/run.js`：无 `context.stopped` 赋值

**影响：** 低（报告状态可能误报）

---

### 3.4 markDone 替换规则不够鲁棒

**问题描述：**  
`load-tasks.js` 解析任务时支持 `-`、`*` 等多种列表标记，但 `mark-done.js` 写回时只替换 `'- [ ]'` 为 `'- [x]'`。如果原始任务用的是 `* [ ]`，替换会失败。

**定位：**  
- `exec/slots/load-tasks.js` 第 49 行：`/^[-*]\s*\[\s*\]\s*(.+)/`（支持 `-` 和 `*`）
- `exec/slots/mark-done.js` 第 42 行：`oldLine.replace('- [ ]', '- [x]')`（只替换 `-`）

**影响：** 低（大多数用户使用 `-`，但 `*` 用户会遇到问题）

---

### 3.5 AGENTS.md 等自由格式约束无法透传

**问题描述：**  
`load-constraints.js` 只解析"硬约束"、"软约束"等结构化片段。如果项目的 `AGENTS.md` 是自由格式的规则文本（没有这些标题），内容会被忽略。

**定位：**  
- `exec/slots/load-constraints.js` 第 18-64 行：`parseConstraints` 函数只提取特定标题下的列表项

**影响：** 中（常见的 AGENTS.md 可能无法生效）

**建议：** 增加"原文透传"模式，将约束文件内容直接附加到 prompt

---

## 四、优化建议（非必须）

> 以下为改进建议，不影响核心功能：

### 4.1 探查结果独立存储

当前探查结果内嵌在 `config.json._probe` 中。建议输出独立的 `probe.json`，便于 AI 读取和用户查看。

### 4.2 补充 lockfile 探查

目前只探查 `package.json`，可增加 lockfile 类型识别（`pnpm-lock.yaml`、`yarn.lock`、`package-lock.json`）以推断更准确的包管理器命令。

### 4.3 AI CLI 预检测

可在初始化时探测 `codex`、`claude` 是否在 PATH 中可用，只在确实需要用户选择时询问。

---

## 问题严重程度汇总

| 问题 | 严重程度 | 模块 | 状态 |
|------|----------|------|------|
| 3.1 依赖未满足时死循环 | 🔴 高 | exec | 已修复 |
| 1.2 模块目录路径不匹配 | 🟡 中 | init/split/exec | 待修复 |
| 1.3 配置更新不幂等 | 🟡 中 | init | 待评估 |
| 1.4 验证命令默认值不合理 | 🟡 中 | init | 待修复 |
| 3.5 自由格式约束无法透传 | 🟡 中 | exec | 待评估 |
| 2.1 --finalize 未实现 | 🟢 低 | split | 更新文档 |
| 3.2 commit hash 未保存 | 🟢 低 | exec | 待修复 |
| 3.3 执行状态判断不准 | 🟢 低 | exec | 待修复 |
| 3.4 markDone 替换不鲁棒 | 🟢 低 | exec | 待修复 |
| 1.1 目录创建不完整 | 🟢 低 | init | 待评估 |
| 2.2 关联模块命名规则不清 | 🟢 低 | split | 待文档化 |

