# VAAL 使用指南

## 安装

### 方式一：克隆到项目子目录

```bash
cd your-project
git clone https://github.com/daoif/vaal.git .vaal
```

### 方式二：Git Submodule

```bash
git submodule add https://github.com/daoif/vaal.git .vaal
```

---

## 初始化

### 步骤 1：运行初始化脚本

```bash
node .vaal/init/scripts/setup.js
```

这会创建 `_workspace` 目录结构和默认配置文件。

### 步骤 2：配置（可选）

在 IDE 中对 AI 说：

```
帮我初始化 VAAL（读取 .vaal/init/docs/GUIDE.md）
```

AI 会引导你完成以下配置：
1. 验证命令（test、lint）
2. Git 策略（commit、push）
3. AI 工具选择

配置文件位置：`.vaal/_workspace/exec/config.json`

---

## 创建任务列表

编辑 `.vaal/_workspace/exec/tasks.md`：

### Markdown 格式

```markdown
# 任务列表

## 待完成
- [ ] 添加用户登录 API
- [ ] 添加用户注册 API
- [ ] 添加密码重置功能

## 已完成
- [x] 创建用户模型
```

---

## 运行

```bash
node .vaal/exec/scripts/run.js
```

脚本会：
1. 读取任务列表
2. 找到第一个未完成的任务
3. 调用 AI CLI 执行任务
4. 运行验证命令
5. 验证通过后执行 Git commit
6. 继续下一个任务

---

## 任务编写建议

### ✅ 好的任务

```markdown
- [ ] 在 utils.js 中添加 formatDate 函数
- [ ] 为 User 模型添加 email 字段验证
- [ ] 修复登录页面的表单验证错误
```

特点：
- 独立可验证
- 粒度小
- 描述清晰

### ❌ 不好的任务

```markdown
- [ ] 实现整个用户系统
- [ ] 重构代码
- [ ] 优化性能
```

问题：
- 太大太模糊
- 无法在一个上下文窗口内完成
- 难以验证"完成"

---

## 错误处理

### 验证失败

如果验证命令失败，脚本会：
1. 停止执行
2. 保留当前状态
3. 输出错误信息

你需要：
1. 查看错误信息
2. 手动修复问题
3. 重新运行脚本

### 中断恢复

脚本支持从中断处恢复：
- 任务状态保存在任务列表文件中
- 重新运行会跳过已完成的任务

---

## 常见问题

### Q: 如何跳过某个任务？

将任务标记为完成：
```markdown
- [x] 这个任务会被跳过
```

### Q: 如何修改配置？

直接编辑 `.vaal/_workspace/exec/config.json`。

### Q: 如何切换 AI 工具？

在配置文件中修改 `slots.execute`：

```json
{
  "slots": {
    "execute": "exec/slots/claude.js"
  }
}
```

可选值：
- `exec/slots/codex.js` - OpenAI Codex CLI
- `exec/slots/claude.js` - Anthropic Claude CLI
