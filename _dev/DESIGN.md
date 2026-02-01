# VAAL 设计文档

**V**-**A**I-**A**uto-**L**oop - AI 自动化任务循环工具

---
## 零、原则

### 原则1: 精准有效
在正确的时机,做正确的事,用正确的方式.

### 原则2: AI与脚本分工
核心: 机器做确定的事,AI做理解的事

脚本职责 - 环境探查、文件操作、格式校验等标准化任务
AI 职责 - 理解上下文、判断场景、灵活引导、异常处理
协作模式 - 脚本生成数据 → AI 分析理解 → AI 给出人性化建议
反模式 - ❌ 脚本里写复杂判断逻辑 / ❌ AI 提示写死所有场景

## 一、项目愿景

### 我们想解决什么问题？

当开发者有一个复杂的功能需求时，通常需要：
1. 手动拆分任务
2. 一个一个地让 AI 执行
3. 每次都要手动验证、提交
4. 出错后手动记录和修复

**VAAL 的目标**：让这个过程自动化，开发者只需要提供设计文档，VAAL 帮你拆分任务并自动循环执行。

### 核心设计理念

VAAL 面向的是**一次性完成大量任务**的场景，而非简单的微调或零散任务。

**设计哲学：**

1. **前期多交互** - 在"设计文档"阶段与 AI 充分对话，打磨需求和方案
2. **自动化不停顿** - 一旦进入拆分/执行阶段，全程自动，不需要人工确认
3. **最终审批** - 拆分完成后给出报告，用户审批通过后进入执行

```
┌─────────────────────────────────────────────────────────────────┐
│  设计阶段      │   拆分阶段    │  审批   │   执行阶段           │
│  (多轮对话)    │   (自动化)    │  (人工) │   (自动化)           │
│  ← 交互密集 →  │  ← 无停顿 →   │         │  ← 无停顿 →          │
└─────────────────────────────────────────────────────────────────┘
```

> **为什么不做简单任务？**  
> 简单任务直接和 AI 交互即可，没必要用 VAAL。  
> VAAL 的价值在于：当任务量大到手动一个个执行很累时，它帮你自动循环。

---

## 二、完整工作流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户完整使用流程                                 │
└─────────────────────────────────────────────────────────────────────────────┘

Phase 0: 设计（在外部完成）
    ↓
    用户在外部 AI 聊天中完善设计文档
    导出设计文档（Markdown 格式）
    ↓
Phase 1: 安装（每仓库一次）
    ↓
    用户克隆 VAAL 到项目子目录：.vaal/
    ↓
Phase 2: 初始化（每仓库一次）
    ↓
    用户运行: node .vaal/init/scripts/setup.js
    或者对 AI 说："帮我初始化 VAAL"
    AI 读取 init/docs/GUIDE.md，与用户对话：
      - 收集验证命令（test, lint）
      - 收集 Git 策略
      - 收集 AI 工具偏好（codex/claude/自定义）
    AI 修改 _workspace/exec/config.json
    
    【高级】如果预设不满足需求：
      - 用户可以自己编写子脚本模块
      - 用户可以自己拼接执行脚本
      - exec/slots/ 目录提供独立可复用的功能模块
    ↓
Phase 3: 导入设计 + 拆分任务
    ↓
    用户对 AI 说："帮我拆分任务"
    AI 读取 split/docs/GUIDE.md，引导用户：
      - 获取设计文档（用户给路径或粘贴内容）
      - 备份设计文档到 _workspace/split/design/original.md（存档用）
      - AI 输出命令（不自己执行）：node .vaal/split/scripts/run.js <设计文档路径>
      - 用户在终端执行命令
    
    脚本自动执行 9 步流程（无人工干预）：
      1. getDesign      - 读取已存档的设计文档
      2. parseModules   - 拆分模块，输出 modules/*.md
      3. LOOP: genTasks - 为每个模块生成测试+实现任务（动态循环）
         └─ 每次生成后进行格式验证
      4. mergeTasks     - 合并相关任务
      5. sortDeps       - 依赖排序
      6. checkConsist1  - 一致性检查（任务 ↔ 模块）
      7. genUserStories - 生成用户故事
      8. checkConsist2  - 一致性检查（用户故事 ↔ 设计文档）
      9. report         - 输出差异报告
    
    脚本完成后，用户回到 AI 对话：
      - AI 引导用户查看 report.md
      - 如需修改，AI 帮助修改
      - 确认后，AI 输出命令：node .vaal/split/scripts/run.js --finalize
      - 用户执行，生成最终 tasks.md
    ↓
Phase 4: 自动执行任务
    ↓
    用户对 AI 说："帮我执行任务"
    AI 读取 exec/docs/GUIDE.md，引导用户：
      - 确认 tasks.md 和 config.json 存在
      - AI 输出命令（不自己执行）：node .vaal/exec/scripts/run.js
      - 用户在终端执行命令
    
    脚本自动循环：
      1. 读取任务列表
      2. 获取下一个待处理任务
      3. 加载任务约束
      4. 检查依赖是否满足
      5. 调用 AI CLI 执行任务（将约束传递给 AI）
      6. 运行验证命令（test, lint）
      7. 验证通过 → Git commit
      8. 验证失败 → 记录并停止
      9. 更新进度，继续下一个任务
    
    脚本完成后，用户回到 AI 对话：
      - AI 引导用户查看 progress.txt 和代码
      - 发现问题 → 回到 Phase 3 添加修复任务
    ↓
Phase 5: 人工复审（循环迭代）
    ↓
    用户审查完成的代码
    发现问题 → 回到 Phase 3 添加修复任务
    确认完成 → 结束
```

---

## 三、核心概念

### 3.1 约束集

每个任务/模块都可以有约束：

| 类型 | 名称 | 说明 | 处理方式 |
|------|------|------|----------|
| 🟢 | 硬约束 | 必须满足 | 验证失败则停止 |
| 🟡 | 软约束 | 建议满足 | 记录警告，继续执行 |
| 🔗 | 依赖 | 前置条件 | 依赖未完成则跳过 |
| ⚠️ | 风险 | 注意事项 | 提示 AI 注意 |

**约束层级（从上到下合并）：**
```
项目级约束 (project-constraints.md 或 AGENTS.md)
    ↓ 合并
模块级约束 (modules/*.md)
    ↓ 合并
任务级约束 (tasks.md 内嵌)
```

### 3.2 任务格式

任务可以包含约束信息：

```markdown
- [ ] [IMPL-001] 实现用户登录 API
  
  **硬约束:**
  - 密码必须使用 bcrypt 加密
  
  **依赖:**
  - IMPL-000: User 模型
  
  **风险:**
  - 暴力破解攻击
```

### 3.3 槽位调度器架构

**核心理念**：主循环只是脚本调度器，不包含任何业务逻辑。

exec 和 split 都采用相同的调度器模式：

```javascript
// run.js 通用结构
for (slot of pipeline.global) await callSlot(slots[slot]);
while (hasMore) {
  for (slot of pipeline.loop) await callSlot(slots[slot]);
}
for (slot of pipeline.finally) await callSlot(slots[slot]);
```

**exec 默认 pipeline：**
```
global:  init → loadTasks
loop:    readNext → loadConstraints → execute → validate → git → markDone
finally: report
```

**split 默认 pipeline：**
```
global:  getDesign → parseModules → loadModules
loop:    genTasks → validateFormat（动态循环，每个模块执行一次）
finally: mergeTasks → sortDeps → checkConsist1 → genUserStories → checkConsist2 → report
```

**split 槽位说明：**

| 阶段 | 槽位 | 中文名 | 职责 |
|------|------|--------|------|
| global | getDesign | 获取设计 | 读取已存档的设计文档到 context |
| global | parseModules | 拆分模块 | 调用 AI 将设计文档拆分为模块文件 |
| global | loadModules | 加载模块 | 读取 modules/ 目录下的模块文件到 context.modules |
| loop | genTasks | 生成任务 | 为当前模块调用 AI 生成测试和实现任务 |
| loop | validateFormat | 验证格式 | 验证生成的任务文件格式（ID 规范、无重复、有关联模块） |
| finally | mergeTasks | 合并任务 | 合并相关任务 |
| finally | sortDeps | 依赖排序 | 按依赖关系排序任务 |
| finally | checkConsist1 | 一致性检查1 | 检查任务与模块的一致性 |
| finally | genUserStories | 生成用户故事 | 从任务生成用户故事 |
| finally | checkConsist2 | 一致性检查2 | 检查用户故事与设计文档的一致性 |
| finally | report | 输出报告 | 生成差异报告 |

> **动态循环**：split 的 loop 阶段会根据 loadModules 加载的模块数量动态执行，每个模块依次调用 genTasks → validateFormat。

**扩展方式：**
- 替换槽位：改 slots 指向自己的脚本
- 增加槽位：往 pipeline 数组里加槽位名
- 删除槽位：从数组里移除

---

## 四、文件结构

### 4.1 按功能划分的目录结构

```
.vaal/
├── init/                        # 功能0：初始化
│   ├── docs/                    # 初始化文档
│   │   └── GUIDE.md             # 初始化引导（AI 读取）
│   ├── scripts/                 # 初始化脚本
│   │   └── setup.js             # 创建目录结构
│   └── templates/               # 初始化模板
│       ├── config.template.json
│       └── project-constraints.template.md
│
├── split/                       # 功能1：拆分任务
│   ├── docs/                    # 拆分相关文档
│   │   ├── GUIDE.md             # 拆分流程说明
│   │   └── CONSTRAINT.schema.md # 约束格式说明
│   ├── scripts/                 # 拆分脚本
│   │   └── run.js               # 槽位调度器
│   ├── slots/                   # 槽位脚本（可插拔）
│   │   ├── get-design.js        # 获取并存档设计文档
│   │   ├── parse-modules.js     # 拆分模块
│   │   ├── load-modules.js      # 加载模块到 context
│   │   ├── gen-tasks.js         # 生成任务（循环调用）
│   │   ├── validate-format.js   # 验证任务格式
│   │   ├── merge-tasks.js       # 合并相关任务
│   │   ├── sort-deps.js         # 依赖排序
│   │   ├── check-consist1.js    # 一致性检查（任务↔模块）
│   │   ├── gen-user-stories.js  # 生成用户故事
│   │   ├── check-consist2.js    # 一致性检查（用户故事↔设计）
│   │   └── report.js            # 输出差异报告
│   └── templates/               # 拆分相关模板
│       ├── task.template.md
│       └── constraint.template.md
│
├── exec/                        # 功能2：执行任务
│   ├── docs/                    # 执行相关文档
│   │   ├── CONFIG.schema.md     # 配置格式说明
│   │   └── USAGE.md             # 使用指南
│   ├── scripts/                 # 执行脚本
│   │   └── run.js               # 槽位调度器
│   └── slots/                   # 槽位脚本（可插拔）
│       ├── init.js              # 初始化上下文
│       ├── load-tasks.js        # 加载任务列表
│       ├── read-next.js         # 获取下一个任务
│       ├── load-constraints.js  # 加载约束
│       ├── codex.js             # 调用 Codex CLI
│       ├── claude.js            # 调用 Claude CLI
│       ├── validate.js          # 运行验证
│       ├── git.js               # Git 提交
│       ├── mark-done.js         # 标记完成
│       └── report.js            # 输出报告
│
├── _dev/                        # VAAL 本身的开发文档
│   └── DESIGN.md                # 设计文档（本文档）
│
└── _workspace/                  # 运行时目录（动态生成）
    ├── split/                   # 拆分功能运行时数据
    │   ├── design/              # 设计文档存档
    │   │   └── original.md
    │   ├── modules/             # 模块文件（动态生成）
    │   │   ├── mod-001.md
    │   │   └── mod-002.md
    │   ├── tasks-draft/         # 各模块任务草稿
    │   │   ├── mod-001-tasks.md
    │   │   └── mod-002-tasks.md
    │   ├── user-stories.md      # 用户故事
    │   └── report.md            # 差异报告
    └── exec/                    # 执行功能运行时数据
        ├── config.json          # 用户配置
        ├── project-constraints.md # 项目约束
        ├── tasks.md             # 任务列表（split 产出）
        └── progress.txt         # 执行进度记录
```

### 4.2 目录分类说明

| 目录 | 类型 | 说明 |
|------|------|------|
| `init/` | 功能模块 | 初始化功能，创建 workspace 目录结构 |
| `split/` | 功能模块 | 拆分任务功能，包含调度器和槽位脚本 |
| `exec/` | 功能模块 | 执行任务功能，包含调度器和槽位脚本 |
| `_dev/` | 开发文档 | VAAL 本身的开发文档，非用户文档 |
| `_workspace/` | 运行时 | 用户项目相关的动态数据，按功能划分子目录 |

---

## 五、用户故事

### US-001: 安装 VAAL

**作为**开发者
**我希望**能快速将 VAAL 安装到我的项目中
**以便**使用自动化任务功能

**验收标准：**
- [x] 运行一条 git clone 命令即可安装
- [x] 不需要 npm install，零依赖
- [x] 安装后可以立即使用

---

### US-002: 初始化配置

**作为**开发者
**我希望**通过与 AI 对话来完成初始化配置
**以便**不需要手动编辑配置文件

**验收标准：**
- [x] 对 AI 说"初始化 VAAL"即可开始
- [x] AI 会询问必要信息（验证命令、Git 策略等）
- [x] AI 自动生成 config.json
- [x] 过程中可以跳过某些配置，使用默认值

---

### US-003: 导入设计文档

**作为**开发者
**我希望**能将设计文档导入 VAAL
**以便**后续自动拆分任务

**验收标准：**
- [x] 可以直接粘贴文档内容
- [x] 可以指定文档路径让 AI 读取
- [x] 设计文档会被存档到 .vaal/_workspace/split/design/

---

### US-004: 自动拆分任务

**作为**开发者
**我希望**运行一个命令就能自动将设计文档拆分为任务列表
**以便**我不需要手动拆分

**验收标准：**
- [x] 运行 `node .vaal/split/scripts/run.js` 开始拆分
- [x] 脚本按 11 步流程自动执行（无人工干预）
- [x] 每个模块独立生成任务，格式自动验证
- [x] 自动进行一致性检查（任务↔模块、用户故事↔设计文档）
- [x] 最后输出差异报告供审查
- [x] 审查通过后生成最终 tasks.md

---

### US-005: 自动执行任务

**作为**开发者
**我希望**运行一个命令就能自动循环执行所有任务
**以便**我可以去做其他事情

**验收标准：**
- [x] 运行 `node .vaal/exec/scripts/run.js` 开始执行
- [x] 自动检查依赖，跳过依赖未完成的任务
- [x] 自动将约束传递给 AI
- [x] 每个任务完成后自动运行验证
- [x] 验证通过自动 Git commit
- [x] 验证失败停止并记录错误
- [x] 中断后自动从上次位置继续（任务状态保存在 tasks.md 中）

---

### US-006: 查看执行进度

**作为**开发者
**我希望**能查看任务执行进度和历史
**以便**了解当前状态

**验收标准：**
- [x] 执行时控制台显示进度
- [x] progress.txt 记录执行历史（表格格式，包含耗时）
- [x] 完成后输出总结报告

---

### US-007: 自定义扩展（高级）

**作为**高级用户
**我希望**能自己编写槽位脚本或调整执行流程
**以便**满足预设之外的特殊需求

**验收标准：**
- [x] exec/slots/ 目录的每个槽位脚本独立可用
- [x] 我可以替换任意槽位（改 config 中 slots 指向）
- [x] 我可以添加自己的槽位脚本
- [x] 我可以修改 pipeline 数组调整执行顺序
- [x] 我可以删除不需要的槽位（如不需要 Git）

**示例场景：**
1. 使用 Gemini CLI → 写 `exec/slots/gemini.js`，slots.execute 指向它
2. 需要特殊验证 → 写 `exec/slots/my-validate.js`，slots.validate 指向它
3. 增加通知功能 → 写 `exec/slots/notify.js`，在 pipeline.loop 里加 "notify"
4. 不需要 Git → 从 pipeline.loop 里删除 "git"

---

## 六、约束与限制

### 技术约束
- 零 npm 依赖，只使用 Node.js 内置模块
- 脚本语言：JavaScript

### AI CLI 调用规范

**关键：能调用 ≠ 能全自动执行**

不同 AI CLI 需要不同的参数才能实现全自动执行：

| 工具 | 全自动命令 | 说明 |
|------|-----------|------|
| Codex | `codex exec --skip-git-repo-check --yolo "prompt"` | `--yolo` 跳过确认 |
| Claude | `claude --dangerously-skip-permissions "prompt"` | 跳过权限确认 |
| 自定义 | `{tool} "prompt"` 或使用 `{prompt}` 占位符 | 用户自行配置 |

在 `config.json` 中配置：
```json
{
  "execution": {
    "tool": "codex",           // 使用预设
    // 或
    "tool": "my-ai --auto {prompt}"  // 自定义命令
  }
}
```

### 前提条件
- 用户需要安装 Node.js
- 用户需要安装 Git
- 用户需要安装 AI CLI 工具（codex/claude 等）

### 范围限制
- VAAL 不负责设计（由用户在外部完成）
- VAAL 不负责代码审查（由用户人工完成）
- VAAL 只是自动化"执行任务 → 验证 → 提交"的循环

---

## 七、已确认的设计决策

1. **任务拆分采用脚本化**
   - 理由：纯文档驱动无法保证质量，复用 exec 的槽位机制确保每步有明确输入/输出
   - 拆分过程本身也是一系列任务，通过 split/scripts/run.js 执行

2. **约束验证依赖 test/lint 命令**
   - 理由：约束传递给 AI 后，AI 负责遵守，最终通过测试验证

3. **不支持 CSV 任务格式**
   - 理由：Markdown 对 AI 更友好，LLM 理解能力更强，约束等复杂内容不适合 CSV

4. **暂不实现 in-progress 状态**
   - 理由：当前单线程串行执行，`- [/]` 和 `- [ ]` 处理方式相同，等有多线程需求时再考虑

