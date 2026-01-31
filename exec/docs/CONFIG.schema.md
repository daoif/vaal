# VAAL 配置说明

配置文件位置：`.vaal/config.json`

---

## 配置项

### validation - 验证配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `test` | string | - | 测试命令 |
| `lint` | string | - | 代码检查命令 |
| `build` | string | - | 构建命令（可选） |
| `custom` | string[] | [] | 其他自定义验证命令 |
| `required` | string[] | ["test"] | 必须通过的验证项 |

示例：
```json
{
  "validation": {
    "test": "npm test",
    "lint": "npm run lint",
    "required": ["test", "lint"]
  }
}
```

---

### git - Git 策略

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `autoCommit` | boolean | true | 任务完成后自动 commit |
| `autoPush` | boolean | false | commit 后自动 push |
| `commitStyle` | string | "conventional" | 提交信息风格 |
| `includeTaskId` | boolean | true | 提交信息包含任务ID |

commitStyle 可选值：
- `conventional` - feat(scope): message
- `simple` - 直接描述
- `custom` - 自定义模板

示例：
```json
{
  "git": {
    "autoCommit": true,
    "autoPush": false,
    "commitStyle": "conventional"
  }
}
```

---

### execution - 执行配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `tool` | string | "codex" | AI 工具 (codex/claude/custom) |
| `toolCommand` | string | - | 自定义工具时的命令 |
| `maxIterations` | number | 50 | 最大任务数限制 |
| `stopOnFailure` | boolean | true | 验证失败时停止 |
| `delayBetweenTasks` | number | 2000 | 任务间隔（毫秒） |

示例：
```json
{
  "execution": {
    "tool": "codex",
    "maxIterations": 50,
    "stopOnFailure": true
  }
}
```

---

### 任务相关

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `taskFormat` | string | "markdown" | 任务格式 (markdown/csv) |
| `taskPath` | string | "tasks.md" | 任务列表文件路径 |
| `progressPath` | string | "progress.txt" | 进度记录文件路径 |

---

## 完整示例

```json
{
  "validation": {
    "test": "npm test",
    "lint": "npm run lint",
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
    "stopOnFailure": true,
    "delayBetweenTasks": 2000
  },
  "taskFormat": "markdown",
  "taskPath": "tasks.md",
  "progressPath": "progress.txt"
}
```
