# 蠢鱼优化（dsh-chunyu-optimize）

本地部署优化：按工作区 / 时段自动切模型，两个本地预设随模型自动匹配，会话续接，SurfCore 人设与记忆分级。

MIT License · 欢迎接力维护，见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 安装

本机（开发态）：源码目录建 junction 到 profile 的 `node_modules`，并在 profile `package.json` 的 `dependencies` 与 `bundles` 里各加一行，重启 DSH。

给别人：

```bash
# 从 GitHub 装
dsh plugin install_bundle --target github:你的用户名/dsh-chunyu-optimize
# 或本地目录装
dsh plugin install_bundle --target file:/path/to/dsh-chunyu-optimize
```

也可以用 `plugin_manager install_bundle` 工具（Web UI 里对 agent 说就行），target 传 `github:用户/仓库`，安装后插件总数 +1，重启后在「设置 → 蠢鱼优化」出现。

## 打开设置页

设置 → **蠢鱼优化**（设置页左侧，order 21）。所有开关、模型池、预设参数、SurfCore 档位都在这一页改，改完点「保存配置」；点「保存并应用到现在所有会话」则立刻把当前会话也切过去。

## 配置存放

- 插件配置：`~/.dsh/chunyu-optimize/config.json`（可直接编辑，也可在设置页改）
- SurfCore：`~/.dsh/surfcore/config.json` 的 `persona` 与 `memoryCard` 两段（其它键原样保留）

## 功能

1. **时段**：峰谷（默认谷时 00:30–08:30，支持跨零点）、自定义时段表（按星期）、始终本地 / 始终在线。峰时策略默认「优先本地」——本地有就用本地，失败自动切在线；谷时默认「只用本地」。
2. **模型池**：本地 / 在线各一组，可填 provider、model、别名；「首选」决定默认用哪一个；本地失败回退带冷却时间。
3. **本地预设**：随插件注册两个预设——`chunyu-local-chat`（本地聊天，鲸鱼娘）、`chunyu-local-work`（本地干活，编程助手）。压缩预算、工具（web / 文件系统）、顺序都可在设置页调。会话按「本地 → 本地预设 / 在线 → 在线预设」自动匹配，也可在设置页改成手动。
4. **会话续接**：新会话创建时按策略切模型 + 切预设；工作区可单独覆盖（自动 / 手动 / 关闭、本地与在线各用哪个预设）；QQ / B 站可单独开关。
5. **工作区覆盖**：给某个工作区钉死模型、策略或预设，优先级高于时段。
6. **SurfCore 联动**：按 QQ / B 站分别设人设与记忆卡的档位（关闭 / 精简 / 标准 / 全量），档位字符预算可改；「本地自动降档」默认关闭，打开后当前选中本地模型时自动用「本地档」。

## 权限、外部服务与失败边界

**文件读写（写权限）**

- 只读写两个位置：`~/.dsh/chunyu-optimize/config.json`（本插件自己的配置）与 `~/.dsh/surfcore/config.json`（只改 `persona`、`memoryCard` 两段，其它键与密钥原样保留）。
- 不写 profile 的 `package.json` / `cordis.patch.yml`，不改工作区文件，不建临时文件、不写日志。

**网络**

- 插件自身不发任何网络请求（没有 `http` / `https` 客户端）。
- 模型调用全部走宿主已有的 provider 路由：本机 Ollama（`127.0.0.1:11434`）或你已配置的在线 API。插件只做「选哪个 provider/model」和「失败时换一个」。

**命令执行与凭据**

- 不执行 shell / 子进程命令。
- 不读取、不存储任何 API Key、Cookie、token；SurfCore 配置里的敏感字段按原样透传，不做解析。

**外部服务**

- 可选：SurfCore（`~/.dsh/surfcore/config.json` + 3100 控制台）。未安装时联动功能自动跳过。
- 可选：Ollama 本地模型；没装也能用，只是本地池为空时按策略走在线。

**失败边界**

- 本地模型调用失败 → 按 `fallback` 配置切到在线目标并重试一次（可关、带冷却，不会死循环）。
- 宿主服务缺失（`sessionController`、`agentPresets` 等）→ 对应功能降级跳过，插件不抛错、不影响 DSH 启动。
- SurfCore 配置文件不存在 / JSON 损坏 → 跳过联动并在设置页报出原因，**不覆盖**原文件。
- 时段判断失败 → 退回「手动选择」，不会自行切换模型。

## 安装 / 卸载

- 安装：见上面「安装」一节（`install_bundle`，target 用 `file:` 目录或 `github:用户/仓库`）。装完重启 DSH，设置页出现「蠢鱼优化」。
- 卸载：`plugin_manager remove_bundle`（或 `dsh plugin remove_bundle dsh-chunyu-optimize`），重启后设置页消失；配置文件 `~/.dsh/chunyu-optimize/` 可留可删。
- 卸载前建议把 SurfCore 档位改回「关闭」，否则人设/记忆卡的字符预算会停在最后一次写入的值（手动改 `~/.dsh/surfcore/config.json` 即可恢复）。

## 验证记录

- 本机 DSH **0.2.1-rc.3**（Windows / Node v24.21.0）上安装、启动、设置页读写、模型切换、预设注册、SurfCore 写入均实测通过。
- `node --check lib/index.js`、`node --check client.js` 与 CI（`.github/workflows/ci.yml`）通过。
- 纯逻辑单测 17 项、mock 运行时测试 8 项通过（未随仓库发布，见 CONTRIBUTING 的本地测试说明）。

## 说明

- 改配置后无需重启 DSH；下次应用 / 新会话即生效。
- 时段边界每分钟检查一次，跨段会自动刷新默认模型（可在设置页关闭 `boundaryRefresh`）。
- 依赖宿主服务：`sessionController`、`agentDefaultModel`、`agentPresets`、`agents`、`workspaceRegistry`、`connection`；缺失的服务会被跳过而不是让插件报错。