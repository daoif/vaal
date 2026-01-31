# VAAL 初始化引导

本文档用于引导 AI 完成 VAAL 的初始化配置。

---

## VAAL 完整工作流

初始化只是第一步，完整流程如下：

```
1. 初始化配置（本文档）
   └── 生成 _workspace/config.json
   
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
- "读取 .vaal/exec/docs/GUIDE.md"

---

## 初始化流程

### Step 1: 问候与说明

向用户解释 VAAL 的作用：

```
你好！我来帮你初始化 VAAL（AI 自动化任务循环工具）。

VAAL 可以帮你：
- 自动循环执行任务列表中的任务
- 每个任务完成后自动验证和 Git 提交
- 支持 Codex、Claude 等 AI CLI 工具

接下来我会问你几个问题来生成配置。
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

#### 2.4 任务列表格式

```
任务列表你想用什么格式？

1. Markdown（推荐）- 使用 - [ ] 格式，直观易编辑
2. CSV - 字段更丰富，适合复杂项目
```

---

### Step 3: 生成配置

根据收集的信息，在 `.vaal/_workspace/` 目录下创建 `config.json`：

```json
{
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
  "execution": {
    "tool": "codex",
    "maxIterations": 50,
    "stopOnFailure": true
  },
  "taskFormat": "markdown",
  "taskPath": "_workspace/tasks.md"
}
```

---

### Step 4: 创建任务列表模板

创建 `.vaal/_workspace/tasks.md`：

```markdown
# 任务列表

## 待完成
- [ ] 示例任务1
- [ ] 示例任务2

## 已完成
<!-- 完成的任务会被移到这里 -->
```

---

### Step 5: 确认配置

在生成配置前，向用户展示并确认：

```
根据你的选择，生成以下配置：

📁 .vaal/_workspace/config.json
[展示完整配置内容]

请确认:
1. 配置是否正确？
2. 是否需要调整？

确认后我将创建文件。
```

---

### Step 6: 引导后续步骤

```
✅ 初始化完成！

已创建文件：
- .vaal/_workspace/config.json（配置文件）
- .vaal/_workspace/tasks.md（任务列表模板）

下一步你可以：

【选项 A】直接编写任务
  编辑 .vaal/_workspace/tasks.md，添加你的任务
  然后运行 node .vaal/exec/scripts/run.js

【选项 B】从设计文档生成任务（推荐）
  对我说："帮我拆分任务"
  我会引导你导入设计文档并生成结构化的任务列表
  包含约束集（硬约束/软约束/依赖/风险）

任务编写建议：
- 每个任务应该独立可验证
- 任务粒度要小，能在一个上下文窗口内完成
- 可以添加约束（见 split/docs/CONSTRAINT.schema.md）
- 避免"实现整个功能"这样的大任务

如果需要修改配置，直接编辑 .vaal/_workspace/config.json。
```

---

## 注意事项

1. **不要假设** - 如果不确定用户需求，要询问
2. **提供默认值** - 让用户可以快速确认或跳过
3. **解释清楚** - 确保用户理解每个选项
4. **确认配置** - 生成配置前先让用户确认
5. **引导下一步** - 告诉用户可以进行任务拆分

---

## 关联文档

- [拆分引导](../../split/docs/GUIDE.md) - 任务拆分引导
- [约束格式](../../split/docs/CONSTRAINT.schema.md) - 约束集结构
- [配置说明](./CONFIG.schema.md) - 配置项说明
- [使用指南](./USAGE.md) - 使用指南
