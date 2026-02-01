# VAAL 初始化引导

本文档用于引导 AI 完成 VAAL 的初始化配置。

---

## 核心原则

**探查优先，不问已知。**

AI 应通过运行脚本和读取目录来获取信息，而非询问用户。

---

## 初始化流程

### Step 1: 运行初始化脚本

```bash
node .vaal/init/scripts/setup.js
```

脚本会自动：
1. 探查仓库状态（技术栈、约束文件、源码结构）
2. 判断仓库类型（A/B/C/D）
3. 创建 `_workspace/` 目录结构
4. 根据探查结果生成适配的 `config.json`
5. 输出探查报告和下一步建议

---

### Step 2: 确认配置

向用户展示脚本输出的探查结果，询问是否需要调整。

**只有以下情况需要询问用户：**
- AI 工具选择（codex / claude）— 无法自动检测
- 脚本探查失败的项目

---

### Step 3: 根据仓库类型引导下一步

#### Type A：空仓库

检测到空仓库时，**主动询问用户需求**：

```
✅ VAAL 初始化完成！

检测到这是一个空仓库，我需要了解你的项目需求：

1. 这个项目打算用什么技术栈？
   - 前端：Vue / React / 纯 HTML+JS
   - 后端：Node.js / Python / Go
   - 全栈：前后端分离 / 单体应用
   
2. 你有设计文档或需求文档吗？
   - 如果有，可以放到 .vaal/_workspace/split/design/
   - 如果没有，我可以帮你梳理需求

请告诉我你的想法，我来帮你初始化项目骨架。
```

**等用户回答后**，再根据用户选择执行具体的初始化命令。

#### Type B：文档阶段

```
✅ VAAL 初始化完成！

检测到项目有设计文档但无代码。建议：

1. 使用 VAAL 拆分任务（推荐）
   - 对我说："帮我拆分任务"
   - 我会读取设计文档并生成结构化任务列表

2. 或手动编写任务
   - 编辑 .vaal/_workspace/exec/tasks.md
```

#### Type C：骨架阶段

```
✅ VAAL 初始化完成！

检测到这是一个骨架项目。

已创建文件：
- .vaal/_workspace/exec/config.json（配置文件）
- .vaal/_workspace/exec/project-constraints.md（项目约束）
- .vaal/_workspace/exec/tasks.md（任务列表模板）

下一步：
1. 编辑 project-constraints.md 设置项目约束
2. 编辑 tasks.md 添加任务
3. 运行 node .vaal/exec/scripts/run.js

或对我说"帮我拆分任务"从设计文档生成任务。
```

#### Type D：开发中

```
✅ VAAL 初始化完成！

检测到这是一个已有代码的项目（中途引入 VAAL）。

已创建文件：
- .vaal/_workspace/exec/config.json（配置文件）
- .vaal/_workspace/exec/tasks.md（任务列表模板）

检测到已有约束文件：[文件名]，已自动配置使用。

下一步：
1. 编辑 tasks.md 添加任务
2. 运行 node .vaal/exec/scripts/run.js

任务编写建议：
- 每个任务应该独立可验证
- 任务粒度要小，能在一个上下文窗口内完成
- 使用关联模块继承模块级约束
- 避免"实现整个功能"这样的大任务
```

---

## 仓库类型判断标准

| 类型 | 特征 |
|------|------|
| **Type A：空仓库** | 无文件或仅有 README |
| **Type B：文档阶段** | 有 docs/ 目录但无 src/、无 package.json |
| **Type C：骨架阶段** | 有 package.json 但无 Git 提交历史 |
| **Type D：开发中** | 有 Git 提交历史 |

---

## 触发方式

当用户说以下话时，运行初始化：
- "初始化 VAAL"
- "帮我配置 VAAL"
- "读取 .vaal/init/docs/GUIDE.md"

---

## 注意事项

1. **先运行脚本** - 确保 setup.js 已运行，探查已完成
2. **不要假设** - 如果探查失败才询问用户
3. **提供默认值** - 让用户可以快速确认或跳过
4. **确认配置** - 修改配置前让用户确认

---

## 关联文档

- [拆分引导](../../split/docs/GUIDE.md) - 任务拆分引导
- [约束格式](../../split/docs/CONSTRAINT.schema.md) - 约束集结构
- [配置说明](../../exec/docs/CONFIG.schema.md) - 配置项说明
- [使用指南](../../exec/docs/USAGE.md) - 使用指南
