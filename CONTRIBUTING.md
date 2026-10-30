# 贡献指南

这个项目欢迎任何人接力维护。开一个 Issue 说说你想改什么，或者直接提 PR。

## 本地开发

```bash
git clone https://github.com/<owner>/dsh-chunyu-optimize.git
cd dsh-chunyu-optimize
```

装到本机 DSH 调试：

```powershell
# 1. 链接进 profile 的 node_modules
New-Item -ItemType Junction -Path "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-chunyu-optimize" -Target "<仓库绝对路径>"

# 2. profile 的 package.json 里 dependencies 加：
#    "dsh-chunyu-optimize": "file:<仓库绝对路径>"
#    bundles 数组末尾加： "dsh-chunyu-optimize"

# 3. 重启 DSH
```

## 提交前自检

```bash
node --check lib/index.js
node --check client.js
```

CI 也会跑这三步。

## 代码结构

- `lib/index.js` — Host 侧：配置读写、时段/工作区判定、模型选择、预设注册、`/api/chunyu` RPC、`agent/request` 与 `agent/request-error` 事件、SurfCore 联动。
- `client.js` — 设置页（`settings.section` 插槽，order 21），自绘表单，通过 `connection.rpc.call('/api', 'chunyu', {...})` 和 Host 通信。
- `cordis.patch.yml` — bundle 入口，插入 `chunyu-optimize` 插件行。
- 插件配置：`~/.dsh/chunyu-optimize/config.json`；SurfCore 只改 `persona`/`memoryCard` 两段。

## 约定

- 不新增 npm 依赖（目前零依赖），保持单文件可读。
- 改设置页时只用插件能拿到的主题 token，不写死颜色。
- 新增可调项优先放进 `DEFAULT_CONFIG` + 设置页，不要用环境变量。
- 版本号按 semver：修 bug 改 patch，加功能改 minor。

## PR

- 一个 PR 一件事，描述里写清「为什么」。
- 涉及配置结构变化时，在 `normalize()` 里做向后兼容（老配置不能炸）。