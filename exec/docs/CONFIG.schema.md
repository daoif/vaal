# VAAL 配置说明

配置文件位置：`.vaal/_workspace/exec/config.json`

---

## 配置项

### paths - 资源路径配置

所有路径都相对于 `.vaal/` 目录，可以根据项目需求自定义。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `tasks` | string | `_workspace/exec/tasks.md` | 任务列表文件 |
| `progress` | string | `_workspace/exec/progress.txt` | 执行进度记录文件 |
| `projectConstraints` | string | `_workspace/exec/project-constraints.md` | 项目级约束文件（固定使用该路径，不支持指向项目根的 `AGENTS.md` 等外部文件） |
| `moduleConstraints` | string | `_workspace/split/modules` | 模块约束目录 |

示例：
```json
{
  "paths": {
    "tasks": "_workspace/exec/tasks.md",
    "projectConstraints": "_workspace/exec/project-constraints.md",
    "moduleConstraints": "_workspace/split/modules"
  }
}
```

---

### validation - 验证配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `test` | string | - | 测试命令 |
| `lint` | string | - | 代码检查命令 |
| `build` | string | - | 构建命令（可选） |
| `custom` | string[] | [] | 其他自定义验证命令 |
| `required` | string[] | [] | 必须通过的验证项（通常为 ["test"]） |

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

### pipeline / slots - 执行流程配置

高级配置，用于自定义执行流程和槽位脚本。

| 字段 | 类型 | 说明 |
|------|------|------|
| `pipeline.global` | string[] | 全局阶段槽位 |
| `pipeline.loop` | string[] | 循环阶段槽位 |
| `pipeline.finally` | string[] | 结束阶段槽位 |
| `slots` | object | 槽位名到脚本路径的映射 |

---

### 其他配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxIterations` | number | 50 | 最大任务数限制 |

---

## 完整示例

```json
{
  "paths": {
    "tasks": "_workspace/exec/tasks.md",
    "projectConstraints": "_workspace/exec/project-constraints.md",
    "moduleConstraints": "_workspace/split/modules"
  },
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
  "maxIterations": 50
}
```
