# VAAL

**V**-**A**I-**A**uto-**L**oop - AI 自动化任务循环工具

## 简介

VAAL 是一个帮助开发者自动化完成大量编码任务的工具。它通过调用 AI CLI（如 Codex、Claude）循环执行任务列表，每完成一个任务就进行验证和 Git 提交。

## 核心理念

1. **每任务独立会话** - 避免上下文累积导致的混淆
2. **文件系统作为状态存储** - 任务列表和进度通过文件传递
3. **验证门控** - 每个任务必须通过验证才能继续

## 安装

```bash
# 克隆到项目子目录
git clone https://github.com/xxx/vaal.git .vaal
```

## 使用

### 1. 初始化

在 IDE 中对 AI 说：

```
请帮我初始化 VAAL（读取 .vaal/exec/docs/GUIDE.md）
```

AI 会引导你完成配置。

### 2. 创建任务列表

编辑 `.vaal/_workspace/tasks.md`：

```markdown
- [ ] 添加用户登录功能
- [ ] 添加用户注册功能
- [ ] 添加密码重置功能
```

### 3. 运行

```bash
node .vaal/exec/scripts/run.js
```

## 目录结构

```
.vaal/
├── split/               # 拆分任务功能
│   ├── docs/            # 拆分相关文档
│   ├── scripts/         # 拆分脚本（未来扩展）
│   └── templates/       # 任务/约束模板
│
├── exec/                # 执行任务功能
│   ├── docs/            # 执行相关文档
│   ├── scripts/         # 执行脚本 (run.js)
│   ├── slots/           # 槽位脚本
│   └── templates/       # 配置模板
│
├── _dev/                # VAAL 开发文档
│
└── _workspace/          # 运行时目录（动态生成）
    ├── config.json      # 用户配置
    ├── tasks.md         # 任务列表
    ├── progress.txt     # 进度记录
    └── design/          # 设计文档存档
```

## 文档

### 执行任务
- [初始化引导](exec/docs/GUIDE.md)
- [配置说明](exec/docs/CONFIG.schema.md)
- [使用指南](exec/docs/USAGE.md)

### 拆分任务
- [拆分引导](split/docs/GUIDE.md)
- [约束格式](split/docs/CONSTRAINT.schema.md)

### 开发
- [设计文档](_dev/DESIGN.md)

## 许可证

MIT
