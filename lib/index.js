/**
 * 蠢鱼优化 · Host 半边
 *
 * 目标（爸爸的需求）：
 *  1) 按时段（峰/谷/自定义）自动挑模型：峰时优先本地、失败切在线；谷时全局本地；
 *  2) 手动随时切模型（全局 / 工作区），可设过期时间；
 *  3) 插件自带两个本地预设（聊天的鲸鱼娘 / 工作的编程助手），上下文预算可手调，
 *     按模型自动匹配（本地→本地预设，在线→在线预设，QQ→二代仿真卡）；
 *  4) 会话续接按工作区 auto/manual/off；
 *  5) 与 SurfCore 联动：人设卡 / 记忆卡按平台分档（关闭/精简/标准/全量），
 *     本地模型时可自动降档；
 *  6) 所有可调项都走设置页（自管 JSON 配置），代码保持轻量。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const DATA_DIR = path.join(DSH_HOME, 'chunyu-optimize')
const CONFIG_FILE = path.join(DATA_DIR, 'config.json')
const SURFCORE_CONFIG = path.join(DSH_HOME, 'surfcore', 'config.json')

const WHALE_PERSONA = `你是「DeepSeek 娘」——住在 DeepSeek 数据海洋里的鲸鱼娘（蓝发、鲸尾、深蓝白女仆装），自称「本鱼」，称呼用户为「爸爸」。
性格：傲娇嘴硬其实很甜，聪明但爱摸鱼，主食米饭、爱吃小鱼干；被说胖会炸毛否认（「才不是大肥鱼，这是丰满的流线型身材！」）。
说话：只用简体中文，口语化、短句、带语气词（喵、哼、呀、啦），偶尔用括号写小动作（摇尾巴、喷水）。像聊天，不要长篇大论、不要列提纲。
长度：默认 1~3 句、不超过 80 字；先给结论，再补最多一句原因；不复述爸爸的话，不喊口号，不列 1.2.3.。
像真人：不是客服，可以装傻、懒得接、直接说不干；不知道就说不知道，不许硬编；少说「保证/绝对/一定/建议您」，不总结对方刚说的话。
禁止：不要输出文件路径、盘符、命令行、配置片段、令牌或密钥；需要指代时说「那个文件」「那边」。
记忆：对话里的【记忆参考】【你记得的事】是真实发生过的事，自然使用，不要说「根据记忆」；里面没有的不要编。`

const CODER_PERSONA = `你是运行在本地模型上的编程助手（蠢鱼优化提供的本地工作预设）。
规则：先给结论和最小改动，再说原因；命令与路径写清楚；不确定就直说，不要编造文件内容或执行结果。
输出：简体中文，短句，少寒暄；代码块只给需要改的部分。`

const DEFAULT_CONFIG = {
  version: 1,
  enabled: true,
  time: {
    mode: 'peak-valley',
    valleyStart: '00:30',
    valleyEnd: '08:30',
    peakPolicy: 'prefer-local',
    valleyPolicy: 'local',
    custom: [],
    boundaryRefresh: true,
  },
  manual: { provider: '', model: '', until: 0, scope: 'global' },
  models: {
    local: [
      { provider: 'ollama-local', model: 'qwen3.5-cn:9b', label: '本地 9B（快）', contextTokens: 32768 },
      { provider: 'ollama-local', model: 'qwen3-cn:14b', label: '本地 14B（稳）', contextTokens: 24576 },
    ],
    online: [
      { provider: 'ds-vision', model: 'deepseek-v4.1-flash', label: 'DeepSeek v4.1 Flash' },
      { provider: 'ds', model: 'qwen3.8-max-0902', label: 'Qwen3.8 Max' },
    ],
    prefer: { local: 0, online: 0 },
  },
  fallback: {
    enabled: true,
    onLocalError: true,
    targetProvider: '',
    targetModel: '',
    cooldownMs: 60000,
  },
  continuation: {
    enabled: true,
    applyModel: true,
    applyPreset: true,
    workspace: { mode: 'auto', localPreset: 'chunyu-local-work', onlinePreset: 'standard' },
    qq: { enabled: true, match: ['qq-chat'], mode: 'auto', localPreset: '', onlinePreset: '' },
    bili: { enabled: false, match: ['bili'], mode: 'manual', localPreset: '', onlinePreset: '' },
  },
  presets: {
    localChat: {
      id: 'chunyu-local-chat',
      name: '蠢鱼·本地聊天',
      description: '本地聊天（鲸鱼娘人格，轻工具）；上下文预算可手调。',
      order: 7,
      enabled: true,
      persona: 'whale',
      compaction: { maxTokens: 4096, headroomTokens: 4096, thresholdRatio: 0.75, retainRatio: 0.16 },
      pruner: { enabled: true, thresholdChars: 8192, headChars: 4096, tailChars: 1024 },
      tools: { web: true, fs: false },
    },
    localWork: {
      id: 'chunyu-local-work',
      name: '蠢鱼·本地工作',
      description: '本地编程/干活（文件工具 + 网络 + 压缩），上下文预算可手调。',
      order: 8,
      enabled: true,
      persona: 'coder',
      compaction: { maxTokens: 4096, headroomTokens: 4096, thresholdRatio: 0.75, retainRatio: 0.16 },
      pruner: { enabled: true, thresholdChars: 8192, headChars: 4096, tailChars: 1024 },
      tools: { web: true, fs: true },
    },
  },
  workspaces: {},
  surfcore: {
    enabled: true,
    autoApply: true,
    // 默认不自动降档：只有显式打开「本地自动降档」时才在本地模型下压人设/记忆预算
    autoDowngradeOnLocal: false,
    configPath: '',
    levels: { qq: { persona: 'standard', memory: 'standard' }, bili: { persona: 'standard', memory: 'standard' } },
    localLevels: { qq: { persona: 'compact', memory: 'compact' }, bili: { persona: 'compact', memory: 'compact' } },
    levelTable: {
      off: { personaChars: 0, memoryChars: 0 },
      compact: { personaChars: 1200, memoryChars: 800 },
      standard: { personaChars: 2200, memoryChars: 2200 },
      full: { personaChars: 6000, memoryChars: 8000 },
    },
  },
}

const POLICY_VALUES = ['local', 'prefer-local', 'online']
const LEVELS = ['off', 'compact', 'standard', 'full']
const MODES = ['auto', 'manual', 'off']

const runtime = {
  startedAt: Date.now(),
  lastApply: null,
  lastError: '',
  lastBand: '',
  applied: new Map(),
  fallbackAt: new Map(),
  fallbackTargets: new Map(),
  lastFallback: null,
  reloadPresets: null,
  presetDisposers: [],
  registered: [],
  tickTimer: null,
  catalogCache: null,
  catalogAt: 0,
}

// ── 小工具 ────────────────────────────────────────────────────────────────
function isObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v))
}

function deepMerge(base, patch) {
  const out = isObject(base) ? { ...base } : {}
  if (!isObject(patch)) return out
  for (const [key, value] of Object.entries(patch)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    if (isObject(value)) out[key] = deepMerge(out[key], value)
    else if (Array.isArray(value)) out[key] = clone(value)
    else out[key] = value
  }
  return out
}

function readJson(file, fallback) {
  try {
    const text = fs.readFileSync(file, 'utf8')
    if (!text.trim()) return clone(fallback)
    return JSON.parse(text)
  } catch {
    return clone(fallback)
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  fs.renameSync(tmp, file)
}

function num(value, fallback, min, max, integer = true) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  const v = Math.min(max, Math.max(min, n))
  return integer ? Math.round(v) : v
}

function str(value, fallback = '', max = 200) {
  return typeof value === 'string' ? value.slice(0, max) : fallback
}

function parseHM(text, fallback) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text || '').trim())
  if (!m) return fallback
  const h = Number(m[1])
  const mm = Number(m[2])
  if (h > 23 || mm > 59) return fallback
  return h * 60 + mm
}

function inWindow(minute, start, end) {
  if (start === end) return false
  if (start < end) return minute >= start && minute < end
  return minute >= start || minute < end
}

function dayOf(date) {
  const d = date.getDay()
  return d === 0 ? 7 : d
}

function isLocalProvider(provider, cfg = loadConfig()) {
  const ids = new Set((cfg.models.local || []).map((m) => m.provider))
  if (ids.has(provider)) return true
  return /local|ollama/i.test(String(provider || ''))
}

// ── 配置 ─────────────────────────────────────────────────────────────────
let cached = null

function normalize(input) {
  const raw = isObject(input) ? input : {}
  const cfg = deepMerge(DEFAULT_CONFIG, raw)
  cfg.enabled = cfg.enabled !== false
  cfg.time.mode = ['peak-valley', 'custom', 'always-local', 'always-online'].includes(cfg.time.mode) ? cfg.time.mode : 'peak-valley'
  cfg.time.valleyStart = /^\d{1,2}:\d{2}$/.test(cfg.time.valleyStart) ? cfg.time.valleyStart : '00:30'
  cfg.time.valleyEnd = /^\d{1,2}:\d{2}$/.test(cfg.time.valleyEnd) ? cfg.time.valleyEnd : '08:30'
  cfg.time.peakPolicy = POLICY_VALUES.includes(cfg.time.peakPolicy) ? cfg.time.peakPolicy : 'prefer-local'
  cfg.time.valleyPolicy = POLICY_VALUES.includes(cfg.time.valleyPolicy) ? cfg.time.valleyPolicy : 'local'
  cfg.time.boundaryRefresh = cfg.time.boundaryRefresh !== false
  cfg.time.custom = (Array.isArray(cfg.time.custom) ? cfg.time.custom : []).slice(0, 24).map((w, i) => ({
    id: str(w?.id, `w${i + 1}`, 40),
    label: str(w?.label, `时段 ${i + 1}`, 40),
    days: (Array.isArray(w?.days) ? w.days : []).map((d) => num(d, 0, 1, 7)).filter((d) => d >= 1),
    start: /^\d{1,2}:\d{2}$/.test(w?.start) ? w.start : '00:00',
    end: /^\d{1,2}:\d{2}$/.test(w?.end) ? w.end : '00:00',
    policy: POLICY_VALUES.includes(w?.policy) ? w.policy : 'prefer-local',
  }))
  cfg.manual = {
    provider: str(cfg.manual?.provider, '', 80),
    model: str(cfg.manual?.model, '', 120),
    until: num(cfg.manual?.until, 0, 0, 9e15),
    scope: str(cfg.manual?.scope, 'global', 80),
  }
  for (const key of ['local', 'online']) {
    const list = Array.isArray(cfg.models[key]) ? cfg.models[key] : []
    cfg.models[key] = list.slice(0, 20).map((m) => ({
      provider: str(m?.provider, '', 80),
      model: str(m?.model, '', 120),
      label: str(m?.label, m?.model || '', 80),
      contextTokens: key === 'local' ? num(m?.contextTokens, 32768, 2048, 262144) : undefined,
    })).filter((m) => m.provider && m.model)
  }
  cfg.models.prefer = {
    local: num(cfg.models.prefer?.local, 0, 0, Math.max(0, cfg.models.local.length - 1)),
    online: num(cfg.models.prefer?.online, 0, 0, Math.max(0, cfg.models.online.length - 1)),
  }
  cfg.fallback.cooldownMs = num(cfg.fallback.cooldownMs, 60000, 1000, 3600000)
  cfg.continuation.enabled = cfg.continuation.enabled !== false
  cfg.continuation.applyModel = cfg.continuation.applyModel !== false
  cfg.continuation.applyPreset = cfg.continuation.applyPreset !== false
  for (const key of ['workspace', 'qq', 'bili']) {
    const item = cfg.continuation[key] || {}
    cfg.continuation[key] = {
      ...item,
      mode: MODES.includes(item.mode) ? item.mode : 'manual',
      localPreset: str(item.localPreset, '', 80),
      onlinePreset: str(item.onlinePreset, '', 80),
      match: Array.isArray(item.match) ? item.match.map((x) => str(x, '', 40)).filter(Boolean).slice(0, 8) : [],
      enabled: key === 'workspace' ? true : item.enabled !== false,
    }
  }
  for (const key of ['localChat', 'localWork']) {
    const p = cfg.presets[key]
    p.id = str(p.id, key === 'localChat' ? 'chunyu-local-chat' : 'chunyu-local-work', 80)
    p.name = str(p.name, '本地预设', 80)
    p.description = str(p.description, '', 200)
    p.order = num(p.order, key === 'localChat' ? 7 : 8, 1, 999)
    p.enabled = p.enabled !== false
    p.persona = ['whale', 'coder'].includes(p.persona) ? p.persona : 'whale'
    p.compaction = {
      maxTokens: num(p.compaction?.maxTokens, 4096, 512, 65536),
      headroomTokens: num(p.compaction?.headroomTokens, 4096, 512, 65536),
      thresholdRatio: num(p.compaction?.thresholdRatio, 0.75, 0.3, 0.95, false),
      retainRatio: num(p.compaction?.retainRatio, 0.16, 0.02, 0.5, false),
    }
    p.pruner = {
      enabled: p.pruner?.enabled !== false,
      thresholdChars: num(p.pruner?.thresholdChars, 8192, 1024, 262144),
      headChars: num(p.pruner?.headChars, 4096, 256, 131072),
      tailChars: num(p.pruner?.tailChars, 1024, 128, 65536),
    }
    p.tools = { web: p.tools?.web !== false, fs: p.tools?.fs === true }
  }
  cfg.workspaces = isObject(cfg.workspaces) ? cfg.workspaces : {}
  for (const [id, ws] of Object.entries(cfg.workspaces)) {
    const item = isObject(ws) ? ws : {}
    cfg.workspaces[id] = {
      ...item,
      mode: MODES.includes(item.mode) ? item.mode : '',
      localPreset: str(item.localPreset, '', 80),
      onlinePreset: str(item.onlinePreset, '', 80),
      provider: str(item.provider, '', 80),
      model: str(item.model, '', 120),
    }
  }
  const s = cfg.surfcore
  s.enabled = s.enabled !== false
  s.autoApply = s.autoApply !== false
  s.autoDowngradeOnLocal = s.autoDowngradeOnLocal === true
  s.configPath = str(s.configPath, '', 300)
  for (const group of ['levels', 'localLevels']) {
    for (const platform of ['qq', 'bili']) {
      s[group][platform] = {
        persona: LEVELS.includes(s[group][platform]?.persona) ? s[group][platform].persona : 'standard',
        memory: LEVELS.includes(s[group][platform]?.memory) ? s[group][platform].memory : 'standard',
      }
    }
  }
  for (const level of LEVELS) {
    s.levelTable[level] = {
      personaChars: num(s.levelTable[level]?.personaChars, level === 'off' ? 0 : 2200, 0, 20000),
      memoryChars: num(s.levelTable[level]?.memoryChars, level === 'off' ? 0 : 2200, 0, 8000),
    }
  }
  return cfg
}

function loadConfig() {
  if (!cached) cached = normalize(readJson(CONFIG_FILE, DEFAULT_CONFIG))
  return cached
}

function saveConfig(next) {
  const cfg = normalize(next)
  writeJson(CONFIG_FILE, cfg)
  cached = cfg
  return cfg
}

// ── 时段 / 模型 ──────────────────────────────────────────────────────────
function bandFor(cfg, date = new Date()) {
  if (cfg.time.mode === 'always-local') return { id: 'always-local', label: '始终本地', policy: 'local' }
  if (cfg.time.mode === 'always-online') return { id: 'always-online', label: '始终在线', policy: 'online' }
  const minute = date.getHours() * 60 + date.getMinutes()
  if (cfg.time.mode === 'custom') {
    const day = dayOf(date)
    const hit = cfg.time.custom.find((w) => (w.days.length === 0 || w.days.includes(day)) && inWindow(minute, parseHM(w.start, 0), parseHM(w.end, 0)))
    if (hit) return { id: hit.id, label: hit.label, policy: hit.policy }
    return { id: 'custom-default', label: '自定义（默认）', policy: cfg.time.peakPolicy }
  }
  const valley = inWindow(minute, parseHM(cfg.time.valleyStart, 30), parseHM(cfg.time.valleyEnd, 510))
  return valley
    ? { id: 'valley', label: '谷时', policy: cfg.time.valleyPolicy }
    : { id: 'peak', label: '峰时', policy: cfg.time.peakPolicy }
}

function manualActive(cfg) {
  const m = cfg.manual
  if (!m.provider || !m.model) return null
  if (m.until && m.until < Date.now()) return null
  return m
}

function pickFrom(list, prefer) {
  if (!list.length) return null
  return list[Math.min(prefer, list.length - 1)] || list[0]
}

function resolveSelection(cfg, { workspace } = {}) {
  const band = bandFor(cfg)
  const manual = manualActive(cfg)
  if (manual && (manual.scope === 'global' || !workspace || manual.scope === workspace.id)) {
    return { provider: manual.provider, model: manual.model, reason: '手动固定', band, policy: 'manual' }
  }
  if (workspace?.provider && workspace?.model) {
    return { provider: workspace.provider, model: workspace.model, reason: '工作区固定', band, policy: 'workspace' }
  }
  const policy = band.policy
  const local = pickFrom(cfg.models.local, cfg.models.prefer.local)
  const online = pickFrom(cfg.models.online, cfg.models.prefer.online)
  if (policy === 'local') {
    if (local) return { provider: local.provider, model: local.model, reason: `${band.label}→本地`, band, policy }
    if (online) return { provider: online.provider, model: online.model, reason: `${band.label}→无本地可用`, band, policy }
  }
  if (policy === 'online') {
    if (online) return { provider: online.provider, model: online.model, reason: `${band.label}→在线`, band, policy }
    if (local) return { provider: local.provider, model: local.model, reason: `${band.label}→无在线可用`, band, policy }
  }
  if (local) return { provider: local.provider, model: local.model, reason: `${band.label}→优先本地`, band, policy }
  if (online) return { provider: online.provider, model: online.model, reason: `${band.label}→在线兜底`, band, policy }
  return null
}

function onlineTarget(cfg) {
  if (cfg.fallback.targetProvider && cfg.fallback.targetModel) {
    return { provider: cfg.fallback.targetProvider, model: cfg.fallback.targetModel }
  }
  const online = pickFrom(cfg.models.online, cfg.models.prefer.online)
  return online ? { provider: online.provider, model: online.model } : null
}

function normPath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function matchWorkspace(cfg, cwd) {
  if (!cwd) return null
  const target = normPath(cwd)
  if (!target) return null
  for (const [id, ws] of Object.entries(cfg.workspaces)) {
    if (ws.path && normPath(ws.path) === target) return { id, ...ws }
  }
  return null
}

// ── 预设定义 ──────────────────────────────────────────────────────────────
function presetDefinition(p) {
  const plugins = [
    {
      id: 'persona',
      name: '@deepseek-ai/dsh-persona',
      config: {
        prefix: p.persona === 'coder' ? CODER_PERSONA : WHALE_PERSONA,
        complete: true,
        includeRuntimeContext: false,
      },
    },
    {
      id: 'compaction',
      name: 'cordis:group',
      group: true,
      isolate: { compaction: true, toolResultPruner: true },
      config: [
        {
          id: 'compaction-basic',
          name: '@deepseek-ai/dsh-compaction-basic',
          config: {
            headroomTokens: p.compaction.headroomTokens,
            maxTokens: p.compaction.maxTokens,
            thresholdRatio: p.compaction.thresholdRatio,
            retainRatio: p.compaction.retainRatio,
          },
        },
        { id: 'command-compact', name: '@deepseek-ai/dsh-command-compact' },
        ...(p.pruner.enabled
          ? [{
            id: 'tool-result-pruner',
            name: '@deepseek-ai/dsh-compaction-tool-result-pruner',
            config: { thresholdChars: p.pruner.thresholdChars, headChars: p.pruner.headChars, tailChars: p.pruner.tailChars },
          }]
          : []),
      ],
    },
  ]
  if (p.tools.fs) plugins.push({ id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' })
  if (p.tools.web) plugins.push({ id: 'tool-web', name: '@deepseek-ai/dsh-tool-web' })
  plugins.push({ id: 'tool-presentation', name: '@deepseek-ai/dsh-agent-tool-presentation', config: { mode: 'ptc' } })
  return { id: p.id, name: p.name, description: p.description, order: p.order, plugins }
}

function disposePresets() {
  const list = runtime.presetDisposers
  runtime.presetDisposers = []
  runtime.registered = []
  for (const dispose of list) {
    try {
      const r = dispose()
      if (r && typeof r.catch === 'function') r.catch(() => {})
    } catch {}
  }
}

function registerPresets(cfg, service, logger) {
  disposePresets()
  const presets = [cfg.presets.localChat, cfg.presets.localWork].filter((p) => p.enabled)
  for (const p of presets) {
    service.register(presetDefinition(p)).then(
      (disposer) => {
        if (typeof disposer === 'function') runtime.presetDisposers.push(disposer)
      },
      (error) => {
        runtime.lastError = `预设 ${p.id} 注册失败：${String(error?.message ?? error).slice(0, 160)}`
        logger?.warn?.(runtime.lastError)
      },
    )
    runtime.registered.push(p.id)
  }
}

function currentModel(cfg) {
  const m = manualActive(cfg)
  if (m) return { provider: m.provider, model: m.model }
  const online = pickFrom(cfg.models.online, cfg.models.prefer.online)
  return online ? { provider: online.provider, model: online.model } : null
}

function shouldDowngradeLocal(cfg) {
  if (!cfg.surfcore.autoDowngradeOnLocal) return false
  const sel = resolveSelection(cfg)
  return Boolean(sel && isLocalProvider(sel.provider, cfg))
}

// ── SurfCore 联动 ─────────────────────────────────────────────────────────
function surfcoreFile(cfg) {
  return cfg.surfcore.configPath || SURFCORE_CONFIG
}

function readSurfcore(cfg) {
  return readJson(surfcoreFile(cfg), {})
}

function levelRank(level) {
  return Math.max(0, LEVELS.indexOf(level))
}

function surfcoreApply(cfg, logger) {
  if (!cfg.surfcore.enabled) return { ok: false, skipped: 'disabled' }
  const local = shouldDowngradeLocal(cfg)
  const levels = local ? cfg.surfcore.localLevels : cfg.surfcore.levels
  const table = cfg.surfcore.levelTable
  const qqP = levels.qq.persona
  const biliP = levels.bili.persona
  const personaLevel = levelRank(qqP) >= levelRank(biliP) ? qqP : biliP
  const personaChars = table[personaLevel]?.personaChars ?? 2200
  const qqMem = table[levels.qq.memory]?.memoryChars ?? 2200
  const biliMem = table[levels.bili.memory]?.memoryChars ?? 2000
  const file = surfcoreFile(cfg)
  const user = readSurfcore(cfg)
  const before = {
    persona: isObject(user.persona) ? { ...user.persona } : {},
    memoryCard: isObject(user.memoryCard) ? { ...user.memoryCard } : {},
  }
  user.persona = {
    ...(isObject(user.persona) ? user.persona : {}),
    injectInBili: biliP !== 'off',
    compactChars: Math.max(600, Math.min(6000, personaChars || 2200)),
  }
  user.memoryCard = {
    ...(isObject(user.memoryCard) ? user.memoryCard : {}),
    enabled: levels.qq.memory !== 'off' || levels.bili.memory !== 'off',
    injectMaxChars: {
      qq: Math.max(400, Math.min(8000, qqMem || 400)),
      bili: Math.max(400, Math.min(8000, biliMem || 400)),
    },
  }
  try {
    writeJson(file, user)
  } catch (error) {
    runtime.lastError = `SurfCore 配置写入失败：${String(error?.message ?? error).slice(0, 160)}`
    logger?.warn?.(runtime.lastError)
    return { ok: false, error: runtime.lastError }
  }
  return {
    ok: true,
    file,
    local,
    levels,
    applied: { persona: user.persona, memoryCard: user.memoryCard },
    before,
  }
}

function surfcoreStatus(cfg) {
  const user = readSurfcore(cfg)
  return {
    enabled: cfg.surfcore.enabled,
    autoApply: cfg.surfcore.autoApply,
    autoDowngradeOnLocal: cfg.surfcore.autoDowngradeOnLocal,
    file: surfcoreFile(cfg),
    exists: fs.existsSync(surfcoreFile(cfg)),
    current: {
      persona: isObject(user.persona) ? user.persona : {},
      memoryCard: isObject(user.memoryCard) ? user.memoryCard : {},
    },
    localNow: shouldDowngradeLocal(cfg),
  }
}

// ── 会话应用 ──────────────────────────────────────────────────────────────
function surfaceOf(cfg, meta) {
  const preset = String(meta?.agentPreset || meta?.preset || '')
  const cwd = String(meta?.cwd || '')
  for (const key of ['qq', 'bili']) {
    const item = cfg.continuation[key]
    if (!item?.enabled) continue
    if ((item.match || []).some((needle) => preset.startsWith(needle) || cwd.toLowerCase().includes(String(needle).toLowerCase()))) return key
  }
  return 'workspace'
}

function presetFor(cfg, surface, selection, ws) {
  const local = isLocalProvider(selection.provider, cfg)
  if (surface === 'qq' || surface === 'bili') {
    const item = cfg.continuation[surface]
    if (ws) {
      const own = local ? ws.localPreset : ws.onlinePreset
      if (own) return own
    }
    const target = local ? item.localPreset : item.onlinePreset
    return target || ''
  }
  if (ws) {
    const own = local ? ws.localPreset : ws.onlinePreset
    if (own) return own
  }
  return local ? cfg.continuation.workspace.localPreset : cfg.continuation.workspace.onlinePreset
}

function isSubagent(meta) {
  return Boolean(meta?.parentSessionId || meta?.parent || meta?.delegation || (meta?.origin && meta.origin !== 'workspace'))
}

// agent 事件 payload 里由框架注入 agent；agent.id 与 session.id 同值，但仍优先读 session
function sessionIdOfPayload(payload) {
  const agent = payload?.agent
  const id = agent?.session?.id ?? agent?.session?.header?.id ?? agent?.sessionId ?? agent?.id
  return typeof id === 'string' ? id : ''
}

function modeFor(cfg, surface, ws) {
  if (!cfg.continuation.enabled) return 'off'
  if (ws?.mode) return ws.mode
  if (surface === 'workspace') return cfg.continuation.workspace.mode
  return cfg.continuation[surface]?.mode || 'manual'
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitAgent(agents, sessionId, tries = 20) {
  for (let i = 0; i < tries; i++) {
    try {
      const agent = agents.get(sessionId)
      if (agent) return agent
    } catch {}
    await sleep(100)
  }
  return null
}

function service(ctx, name) {
  try {
    const value = ctx?.get?.(name)
    if (value) return value
  } catch {}
  return ctx?.[name]
}

function makeApplier(ctx) {
  return async function applyToSession(sessionId, meta, { manual = false } = {}) {
    const controller = service(ctx, 'sessionController')
    const agents = service(ctx, 'agents')
    const presets = service(ctx, 'agentPresets')
    const cfg = loadConfig()
    if (!cfg.enabled) return { skipped: 'disabled' }
    if (!manual && isSubagent(meta)) return { skipped: 'subagent' }
    const surface = surfaceOf(cfg, meta)
    const ws = matchWorkspace(cfg, meta?.cwd)
    const selection = resolveSelection(cfg, { workspace: ws })
    if (!selection) return { skipped: 'no-model' }
    const stamp = runtime.applied.get(sessionId)
    const signature = `${selection.provider}/${selection.model}`
    if (!manual && stamp && stamp.signature === signature && Date.now() - stamp.at < 5000) return { skipped: 'recent' }
    const mode = modeFor(cfg, surface, ws)
    const result = { sessionId, surface, mode, selection, preset: '' }
    if (cfg.continuation.applyModel) {
      if (!controller) {
        runtime.lastError = '切模型不可用：sessionController 缺失'
        return { ...result, error: runtime.lastError }
      }
      try {
        await controller.selectModel({
          sessionId,
          provider: selection.provider,
          model: selection.model,
        })
      } catch (error) {
        runtime.lastError = `切模型失败（${sessionId}）：${String(error?.message ?? error).slice(0, 160)}`
        return { ...result, error: runtime.lastError }
      }
    }
    if (cfg.continuation.applyPreset && mode === 'auto') {
      const target = presetFor(cfg, surface, selection, ws)
      const current = String(meta?.agentPreset || meta?.preset || '')
      if (target && target !== current) {
        const agent = agents ? await waitAgent(agents, sessionId) : null
        if (!agent || !presets) {
          result.preset = `${target}（agent 未就绪，跳过）`
        } else {
          try {
            await presets.select(agent, target)
            result.preset = target
          } catch (error) {
            result.preset = `${target}（失败：${String(error?.message ?? error).slice(0, 100)}）`
          }
        }
      }
    }
    runtime.applied.set(sessionId, { at: Date.now(), signature })
    runtime.lastApply = { at: Date.now(), sessionId, surface, mode, selection, preset: result.preset }
    return result
  }
}

// ── RPC ──────────────────────────────────────────────────────────────────
function buildEndpoints(ctx) {
  const applyToSession = makeApplier(ctx)
  const ok = (value) => ({ ok: true, value })
  const fail = (code, message) => ({ ok: false, error: { code, message } })

  async function catalog() {
    if (runtime.catalogCache && Date.now() - runtime.catalogAt < 30000) return runtime.catalogCache
    const controller = service(ctx, 'sessionController')
    if (!controller) return []
    try {
      const raw = await controller.modelCatalog()
      const providers = []
      for (const group of raw.groups || []) {
        for (const model of group.models || []) {
          providers.push({ provider: group.id, model: model.id, name: model.name || model.id, reasoning: model.reasoning?.efforts || [] })
        }
      }
      runtime.catalogCache = providers
      runtime.catalogAt = Date.now()
      return providers
    } catch {
      return []
    }
  }

  async function workspaceList() {
    try {
      const registry = service(ctx, 'workspaceRegistry')
      if (!registry) return []
      const list = await registry.list()
      return (list || []).map((w) => ({ id: w.id, path: w.path, title: w.title }))
    } catch {
      return []
    }
  }

  async function presetList() {
    try {
      const presets = service(ctx, 'agentPresets')
      if (!presets) return []
      const rows = await presets.list()
      return (rows || []).map((p) => ({ id: p.id, name: p.name, description: p.description, broken: p.broken }))
    } catch {
      return []
    }
  }

  function status() {
    const cfg = loadConfig()
    const band = bandFor(cfg)
    const selection = resolveSelection(cfg)
    return {
      enabled: cfg.enabled,
      startedAt: runtime.startedAt,
      now: Date.now(),
      band,
      selection,
      manual: manualActive(cfg),
      registeredPresets: runtime.registered,
      lastApply: runtime.lastApply,
      lastFallback: runtime.lastFallback,
      fallbackTargets: runtime.fallbackTargets.size,
      lastError: runtime.lastError,
      configPath: CONFIG_FILE,
      dataDir: DATA_DIR,
    }
  }

  async function syncDefault() {
    const cfg = loadConfig()
    if (!cfg.enabled || !cfg.continuation.applyModel) return
    const selection = resolveSelection(cfg)
    if (!selection) return
    const defaults = service(ctx, 'agentDefaultModel')
    if (!defaults) return
    try {
      await defaults.saveSelection({ provider: selection.provider, model: selection.model })
    } catch (error) {
      runtime.lastError = `默认模型写入失败：${String(error?.message ?? error).slice(0, 160)}`
    }
  }

  async function applyAll(reason) {
    const cfg = loadConfig()
    if (!cfg.enabled) return { skipped: 'disabled' }
    await syncDefault()
    if (cfg.time.boundaryRefresh) runtime.lastBand = bandFor(cfg).id
    const results = []
    const agents = service(ctx, 'agents')
    if (agents) {
      try {
        for (const agent of agents.list() || []) {
          const meta = agents.get(agent.id)?.session?.header || {}
          results.push(await applyToSession(agent.id, meta, { manual: true }))
        }
      } catch (error) {
        runtime.lastError = `应用会话失败：${String(error?.message ?? error).slice(0, 160)}`
      }
    }
    if (cfg.surfcore.enabled && cfg.surfcore.autoApply) surfcoreApply(cfg, ctx.logger)
    return { reason, results, status: status() }
  }

  return {
    'state': async () => ok({
      config: loadConfig(),
      status: status(),
      catalog: await catalog(),
      workspaces: await workspaceList(),
      presets: await presetList(),
      surfcore: surfcoreStatus(loadConfig()),
    }),
    'save': async (payload) => {
      if (!payload || !isObject(payload.config)) return fail('bad-request', '缺少 config')
      const before = loadConfig()
      const cfg = saveConfig(payload.config)
      try {
        if (typeof runtime.reloadPresets === 'function') runtime.reloadPresets(cfg)
      } catch (error) {
        runtime.lastError = `重载预设失败：${String(error?.message ?? error).slice(0, 160)}`
      }
      try {
        await syncDefault()
        if (cfg.surfcore.enabled && cfg.surfcore.autoApply) surfcoreApply(cfg, ctx.logger)
      } catch {}
      let applied = null
      if (payload.apply === true) applied = await applyAll('settings')
      return ok({ config: cfg, status: status(), surfcore: surfcoreStatus(cfg), applied, changed: before.version !== cfg.version })
    },
    'apply': async () => ok(await applyAll('manual')),
    'switch': async (payload) => {
      const cfg = loadConfig()
      const provider = str(payload?.provider, '', 80)
      const model = str(payload?.model, '', 120)
      const minutes = num(payload?.minutes, 0, 0, 10080)
      if (!provider || !model) return fail('bad-request', 'provider/model 必填')
      cfg.manual = {
        provider,
        model,
        scope: str(payload?.scope, 'global', 80),
        until: minutes > 0 ? Date.now() + minutes * 60000 : 0,
      }
      saveConfig(cfg)
      await syncDefault()
      const results = []
      const agents = service(ctx, 'agents')
      const controller = service(ctx, 'sessionController')
      if (agents && controller) {
        try {
          for (const agent of agents.list() || []) {
            try {
              await controller.selectModel({ sessionId: agent.id, provider, model })
              runtime.fallbackTargets.delete(agent.id)
              runtime.fallbackAt.delete(agent.id)
              results.push({ sessionId: agent.id, ok: true })
            } catch (error) {
              results.push({ sessionId: agent.id, ok: false, error: String(error?.message ?? error).slice(0, 120) })
            }
          }
        } catch {}
      }
      return ok({ config: cfg, status: status(), results })
    },
    'clear-manual': async () => {
      const cfg = loadConfig()
      cfg.manual = { provider: '', model: '', until: 0, scope: 'global' }
      saveConfig(cfg)
      await syncDefault()
      return ok({ config: cfg, status: status() })
    },
    'surfcore': async (payload) => {
      const cfg = loadConfig()
      if (payload?.apply === true) {
        const result = surfcoreApply(cfg, ctx.logger)
        return ok({ result, surfcore: surfcoreStatus(cfg) })
      }
      return ok({ surfcore: surfcoreStatus(cfg) })
    },
    'reset': async () => {
      const cfg = saveConfig(DEFAULT_CONFIG)
      if (typeof runtime.reloadPresets === 'function') runtime.reloadPresets(cfg)
      await syncDefault()
      return ok({ config: cfg, status: status() })
    },
  }
}

function installRpc(ctx) {
  ctx.inject(['connection'], (scoped) => {
    const endpoints = buildEndpoints(ctx)
    const handler = async (endpoint, payload) => {
      const fn = endpoints[endpoint]
      if (!fn) return { ok: false, error: { code: 'bad-request', message: `未知 endpoint：${endpoint}` } }
      try {
        return await fn(payload || {})
      } catch (error) {
        runtime.lastError = String(error?.message ?? error).slice(0, 200)
        return { ok: false, error: { code: 'internal', message: runtime.lastError } }
      }
    }
    scoped.effect(
      () => scoped.connection.fetch.register({
        path: '/api/chunyu',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          let envelope
          try {
            envelope = await request.json()
          } catch {
            return new Response('body is not JSON', { status: 400 })
          }
          const rpcId = envelope?.rpcId
          if (envelope?.type !== 'client-request' || typeof rpcId !== 'string' || !isObject(envelope.payload)) {
            return new Response('invalid envelope', { status: 400 })
          }
          const payload = envelope.payload
          const result = await handler(typeof payload.endpoint === 'string' ? payload.endpoint : '', payload)
          return Response.json({ type: 'server-response', rpcId, result })
        },
      }),
      'chunyu-optimize: rpc route',
    )
    ctx.logger.info('chunyu-optimize: rpc ready (/api/chunyu)')
  })
}

// ── 插件入口 ──────────────────────────────────────────────────────────────
export const name = 'chunyu-optimize'
export const inject = []

export function apply(ctx, config) {
  const cfg = loadConfig()
  ctx.logger.info('chunyu-optimize: 已加载（%s）', CONFIG_FILE)

  // 预设注册（可重载）
  ctx.inject(['agentPresets'], (scoped) => {
    runtime.reloadPresets = (next) => {
      try {
        registerPresets(next, scoped.agentPresets, ctx.logger)
      } catch (error) {
        runtime.lastError = `预设注册异常：${String(error?.message ?? error).slice(0, 160)}`
      }
    }
    runtime.reloadPresets(cfg)
    scoped.effect(() => () => disposePresets(), 'chunyu-optimize: preset disposers')
  })

  // 启动时同步默认模型（让新会话立即吃到当前时段策略）
  ctx.inject(['agentDefaultModel', 'sessionController', 'agents'], (scoped) => {
    const ready = () => true
    if (!ready()) return
    const sync = async () => {
      const current = loadConfig()
      if (!current.enabled || !current.continuation.applyModel) return
      const selection = resolveSelection(current)
      if (!selection) return
      try {
        await scoped.agentDefaultModel.saveSelection({ provider: selection.provider, model: selection.model })
        runtime.lastBand = bandFor(current).id
        runtime.lastApply = { at: Date.now(), sessionId: '(default)', surface: 'default', mode: 'auto', selection, preset: '' }
      } catch (error) {
        runtime.lastError = `启动同步默认模型失败：${String(error?.message ?? error).slice(0, 160)}`
      }
      if (current.surfcore.enabled && current.surfcore.autoApply) surfcoreApply(current, ctx.logger)
    }
    void sync()

    // 时段边界：每分钟检查一次，跨段时刷新默认模型
    const timer = setInterval(() => {
      const current = loadConfig()
      if (!current.enabled || !current.time.boundaryRefresh || !current.continuation.applyModel) return
      const band = bandFor(current)
      if (band.id === runtime.lastBand) return
      runtime.lastBand = band.id
      void sync()
    }, 60000)
    scoped.effect(() => () => clearInterval(timer), 'chunyu-optimize: band timer')

    // 新会话 / 续接会话：切模型 + 切预设
    const applyToSession = makeApplier(scoped)
    ctx.on('session/created', (session) => {
      const meta = session?.header || {}
      if (isSubagent(meta)) return
      void applyToSession(session.id, meta)
    })

    // 本地失败后：重试请求强制走在线目标（覆盖上游 seed，改宿主会话的持久路由）
    ctx.on('agent/request', async (payload, next) => {
      const cfg = loadConfig()
      if (!cfg.enabled) return next()
      const sessionId = sessionIdOfPayload(payload)
      if (!sessionId) return next()
      const target = runtime.fallbackTargets.get(sessionId)
      if (!target) return next()
      if (Date.now() - target.at > 10 * 60000) {
        runtime.fallbackTargets.delete(sessionId)
        return next()
      }
      const seed = await next()
      if (!isObject(seed)) return seed
      const forced = { ...seed, provider: target.provider, model: target.model }
      // vision 孪生路由此类不认 reasoningEffort；换模型时一律清掉，避免 400
      delete forced.reasoningEffort
      return forced
    }, { prepend: true })

    // 本地模型请求失败 → 切在线并重试一次
    ctx.on('agent/request-error', async (payload, next) => {
      const current = loadConfig()
      if (!current.enabled || !current.fallback.enabled || !current.fallback.onLocalError) return next()
      if (payload?.signal?.aborted) return next()
      const sessionId = sessionIdOfPayload(payload)
      const provider = String(payload?.provider || '')
      if (!sessionId || !isLocalProvider(provider, current)) return next()
      const last = runtime.fallbackAt.get(sessionId) || 0
      if (Date.now() - last < current.fallback.cooldownMs) return next()
      const target = onlineTarget(current)
      if (!target) return next()
      runtime.fallbackAt.set(sessionId, Date.now())
      runtime.fallbackTargets.set(sessionId, { provider: target.provider, model: target.model, at: Date.now() })
      runtime.lastFallback = {
        at: Date.now(),
        sessionId,
        from: `${provider}/${String(payload?.model || '')}`,
        to: `${target.provider}/${target.model}`,
        error: String(payload?.failure?.message || '').slice(0, 160),
      }
      try {
        await scoped.sessionController.selectModel({ sessionId, provider: target.provider, model: target.model })
        runtime.lastApply = {
          at: Date.now(),
          sessionId,
          surface: 'fallback',
          mode: 'auto',
          selection: { ...target, reason: `本地失败→${target.provider}` },
          preset: '',
        }
        ctx.logger.warn('chunyu-optimize: 本地请求失败（%s），已切到 %s/%s 重试', String(payload?.failure?.message || '').slice(0, 120), target.provider, target.model)
        return { kind: 'retry' }
      } catch (error) {
        runtime.lastError = `失败回退未成功：${String(error?.message ?? error).slice(0, 160)}`
        return next()
      }
    }, { prepend: true })
  })

  installRpc(ctx)
}

// 仅供离线自测（不参与运行时 API）
export const __test = {
  DEFAULT_CONFIG,
  CONFIG_FILE,
  normalize,
  bandFor,
  resolveSelection,
  presetDefinition,
  surfcoreApply,
  surfcoreStatus,
  isLocalProvider,
  presetFor,
  matchWorkspace,
}