# VAAL 初始化引导

本文档用于引导 AI 完成 VAAL 的初始化配置。

---

## VAAL 完整工作流

初始化只是第一步，完整流程如下：

```
1. 初始化配置（本文档）
   └── 运行 node .vaal/init/scripts/setup.js
   └── 生成 _workspace/ 目录结构
   
2. 导入设计文档（可选）
   └── 见 split/docs/GUIDE.md
   
3. 拆分任务
   └── 设计文档 → 模块 → 任务列表
   └── 包含约束集（硬约束/软约束/依赖/风险）
   
4. 执行任务
   └── node .vaal/exec/scripts/run.js
```

如果用户已有任务列表，可以跳过步骤 2-3。

---

## 触发方式

当用户说以下话时，表示需要初始化 VAAL：
- "初始化 VAAL"
- "帮我配置 VAAL"
- "读取 .vaal/init/docs/GUIDE.md"

---

## 初始化流程

### Step 0: 运行初始化脚本

首先运行初始化脚本创建目录结构：

```bash
node .vaal/init/scripts/setup.js
```

这会自动创建：
- `.vaal/_workspace/split/design/modules/` - 模块约束目录
- `.vaal/_workspace/exec/config.json` - 配置文件
- `.vaal/_workspace/exec/project-constraints.md` - 项目约束文件
- `.vaal/_workspace/exec/tasks.md` - 任务列表模板

---

### Step 1: 问候与说明

向用户解释 VAAL 的作用：

```
你好！我来帮你初始化 VAAL（AI 自动化任务循环工具）。

VAAL 可以帮你：
- 自动循环执行任务列表中的任务
- 每个任务完成后自动验证和 Git 提交
- 支持 Codex、Claude 等 AI CLI 工具
- 三层约束体系（项目/模块/任务）确保代码质量

接下来我会问你几个问题来完善配置。
```

---

### Step 2: 收集信息

依次询问以下信息：

#### 2.1 验证命令

```
请告诉我你项目的验证命令：

1. 测试命令是什么？（例如：npm test, pytest, go test）
2. 代码检查命令是什么？（例如：npm run lint, flake8）
3. 还有其他需要的验证命令吗？

如果暂时没有，可以说"跳过"，后续可以在 config.json 中添加。
```

#### 2.2 Git 策略

```
关于 Git 操作，你希望：

1. 每个任务完成后自动 commit？（推荐：是）
2. commit 后自动 push 吗？（推荐：否，手动 push）
3. 提交信息使用什么风格？
   - conventional: feat(scope): message
   - simple: 直接描述
```

#### 2.3 AI 工具

```
你打算使用什么 AI 工具执行任务？

1. codex - OpenAI Codex CLI
2. claude - Anthropic Claude CLI
3. 其他 - 请告诉我命令名称
```

#### 2.4 项目约束（可选）

```
项目中是否已有 AGENTS.md、CLAUDE.md 等文件？

如果有，我可以配置 VAAL 直接使用它作为项目级约束。
如果没有，可以使用默认的 project-constraints.md，稍后编辑。
```

---

### Step 3: 修改配置

根据收集的信息，修改 `.vaal/_workspace/exec/config.json`：

```json
{
  "paths": {
    "tasks": "_workspace/exec/tasks.md",
    "projectConstraints": "_workspace/exec/project-constraints.md",
    "moduleConstraints": "_workspace/split/design/modules"
  },
  "validation": {
    "test": "用户提供的测试命令",
    "lint": "用户提供的lint命令",
    "required": ["test"]
  },
  "git": {
    "autoCommit": true,
    "autoPush": false,
    "commitStyle": "conventional"
  },
  "slots": {
    "execute": "exec/slots/codex.js"
  },
  "maxIterations": 50
}
```

配置要点：
- 如果用户选择 Claude，将 `slots.execute` 改为 `exec/slots/claude.js`
- 如果用户有 AGENTS.md，将 `paths.projectConstraints` 改为 `../AGENTS.md`

---

### Step 4: 确认配置

向用户展示并确认：

```
根据你的选择，配置如下：

📁 .vaal/_workspace/exec/config.json
[展示完整配置内容]

请确认:
1. 配置是否正确？
2. 是否需要调整？

确认后即可开始使用。
```

---

### Step 5: 引导后续步骤

```
✅ 初始化完成！

已创建文件：
- .vaal/_workspace/exec/config.json（配置文件）
- .vaal/_workspace/exec/project-constraints.md（项目约束）
- .vaal/_workspace/exec/tasks.md（任务列表模板）
- .vaal/_workspace/split/design/modules/（模块约束目录）

下一步你可以：

【选项 A】直接编写任务
  1. 编辑 .vaal/_workspace/exec/project-constraints.md 设置项目约束
  2. 编辑 .vaal/_workspace/exec/tasks.md 添加任务
  3. 运行 node .vaal/exec/scripts/run.js

【选项 B】从设计文档生成任务（推荐）
  对我说："帮我拆分任务"
  我会引导你导入设计文档并生成结构化的任务列表
  包含约束集（硬约束/软约束/依赖/风险）

任务编写建议：
- 每个任务应该独立可验证
- 任务粒度要小，能在一个上下文窗口内完成
- 使用关联模块继承模块级约束
- 避免"实现整个功能"这样的大任务

如果需要修改配置，直接编辑 .vaal/_workspace/exec/config.json。
```

---

## 注意事项

1. **先运行脚本** - 确保 setup.js 已运行，目录结构已创建
2. **不要假设** - 如果不确定用户需求，要询问
3. **提供默认值** - 让用户可以快速确认或跳过
4. **解释清楚** - 确保用户理解每个选项
5. **确认配置** - 修改配置前先让用户确认
6. **引导下一步** - 告诉用户可以进行任务拆分

---

## 关联文档

- [拆分引导](../../split/docs/GUIDE.md) - 任务拆分引导
- [约束格式](../../split/docs/CONSTRAINT.schema.md) - 约束集结构
- [配置说明](../../exec/docs/CONFIG.schema.md) - 配置项说明
- [使用指南](../../exec/docs/USAGE.md) - 使用指南
