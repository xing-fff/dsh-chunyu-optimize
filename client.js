// 蠢鱼优化 · 设置页（client 半边）
//
// 约定（与 dsh-heartbeat / dsh-vision-router 对齐）：
//   - 客户端模块经 ModuleLoader 以 client-side cordis 插件形式加载；
//   - 设置页挂在 'settings.section' slot，一个插件一页；
//   - 所有数据走 /api RPC：ctx.get('connection').rpc.call('/api', 'chunyu', {endpoint, ...payload})；
//   - 主题只用 --dsw-* token，按钮主色 #339CFF。
window.__ModuleLoader__.load({
	id: "dsh-chunyu-optimize",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		const React = require("react");
		const el = React.createElement;

		const NS = "dsh-chunyu-optimize";
		const NS_LABEL = "蠢鱼优化";

		// ── 样式 ────────────────────────────────────────────────────────────
		const S = {
			wrap: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--dsw-alias-label-primary)" },
			row: { display: "flex", alignItems: "center", gap: 8, margin: "5px 0", flexWrap: "wrap" },
			label: { minWidth: 168, fontSize: 13, color: "var(--dsw-alias-label-secondary)", flex: "none" },
			hint: { fontSize: 12, color: "var(--dsw-alias-label-tertiary)", margin: "2px 0", lineHeight: 1.5 },
			sub: { fontSize: 12, color: "var(--dsw-alias-label-tertiary)", margin: "2px 0 6px 0", lineHeight: 1.5 },
			input: { height: 28, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-specific-input-bg, transparent)", color: "var(--dsw-alias-label-primary)", padding: "0 8px", fontSize: 13, outline: "none" },
			select: { height: 28, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-specific-input-bg, transparent)", color: "var(--dsw-alias-label-primary)", padding: "0 6px", fontSize: 13 },
			btn: { height: 28, padding: "0 14px", borderRadius: 8, border: "none", background: "#339CFF", color: "#fff", fontSize: 12, cursor: "pointer", flex: "none" },
			btnGhost: { height: 28, padding: "0 12px", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", background: "transparent", color: "var(--dsw-alias-label-primary)", fontSize: 12, cursor: "pointer", flex: "none" },
			btnWarn: { height: 28, padding: "0 12px", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", background: "transparent", color: "#e5484d", fontSize: 12, cursor: "pointer", flex: "none" },
			section: { borderTop: "1px solid var(--dsw-alias-border-l2)", marginTop: 8, paddingTop: 6 },
			summary: { fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary)", cursor: "pointer", padding: "2px 0" },
			card: { border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 10, padding: "8px 10px", margin: "6px 0", display: "flex", flexDirection: "column", gap: 2 },
			cardTitle: { fontSize: 13, fontWeight: 600 },
			chip: { display: "inline-block", padding: "1px 8px", borderRadius: 999, border: "1px solid var(--dsw-alias-border-l2)", fontSize: 12, color: "var(--dsw-alias-label-secondary)" },
			bar: { position: "sticky", bottom: 0, display: "flex", alignItems: "center", gap: 8, padding: "8px 0", background: "var(--dsw-specific-bg, transparent)", flexWrap: "wrap" },
			dirty: { fontSize: 12, color: "#eeba18" },
			error: { fontSize: 12, color: "#e5484d", whiteSpace: "pre-wrap" },
			ok: { fontSize: 12, color: "#41ba41" },
			mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 12 },
			table: { borderCollapse: "collapse", fontSize: 12, margin: "4px 0" },
			th: { textAlign: "left", padding: "3px 8px", color: "var(--dsw-alias-label-secondary)", fontWeight: 500, borderBottom: "1px solid var(--dsw-alias-border-l2)" },
			td: { padding: "3px 8px" },
		};

		const clone = (v) => JSON.parse(JSON.stringify(v));
		const POLICY = [
			{ value: "prefer-local", label: "优先本地（失败切在线）" },
			{ value: "local", label: "只用本地" },
			{ value: "online", label: "只用在线" },
		];
		const MODE = [
			{ value: "auto", label: "自动（按模型匹配预设）" },
			{ value: "manual", label: "手动（只切模型，不动预设）" },
			{ value: "off", label: "关闭续接" },
		];
		const SURFACE_MODE = [
			{ value: "auto", label: "自动" },
			{ value: "manual", label: "手动" },
			{ value: "off", label: "关闭" },
		];
		const LEVEL = [
			{ value: "off", label: "关闭（不注入）" },
			{ value: "compact", label: "精简" },
			{ value: "standard", label: "标准" },
			{ value: "full", label: "全量" },
		];
		const PERSONA = [
			{ value: "whale", label: "鲸鱼娘（聊天）" },
			{ value: "coder", label: "编程助手（干活）" },
		];
		const DAYS = [
			{ value: 1, label: "一" }, { value: 2, label: "二" }, { value: 3, label: "三" },
			{ value: 4, label: "四" }, { value: 5, label: "五" }, { value: 6, label: "六" }, { value: 7, label: "日" },
		];

		// ── 基础控件 ────────────────────────────────────────────────────────
		function Select(props) {
			const opts = props.options || [];
			return el(
				"select",
				{ style: { ...S.select, width: props.width || 180 }, value: props.value ?? "", disabled: props.disabled, onChange: (e) => props.onChange(e.target.value) },
				opts.map((o) => el("option", { key: String(o.value), value: o.value }, o.label)),
			);
		}
		function TextBox(props) {
			return el("input", {
				style: { ...S.input, width: props.width || 180, ...(props.mono ? S.mono : null) },
				value: props.value ?? "",
				placeholder: props.placeholder || "",
				disabled: props.disabled,
				onChange: (e) => props.onChange(e.target.value),
			});
		}
		function NumBox(props) {
			return el("input", {
				type: "number",
				style: { ...S.input, width: props.width || 92 },
				value: props.value ?? 0,
				min: props.min,
				max: props.max,
				step: props.step || 1,
				disabled: props.disabled,
				onChange: (e) => props.onChange(e.target.value === "" ? 0 : Number(e.target.value)),
			});
		}
		function Check(props) {
			return el(
				"label",
				{ style: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--dsw-alias-label-primary)", cursor: "pointer" } },
				el("input", { type: "checkbox", checked: !!props.checked, onChange: (e) => props.onChange(e.target.checked) }),
				props.label,
			);
		}
		function Field(props) {
			return el(
				"div",
				{ style: S.row },
				el("span", { style: S.label }, props.label),
				props.children,
				props.hint ? el("span", { style: S.hint }, props.hint) : null,
			);
		}
		function Section(props) {
			const [open, setOpen] = React.useState(props.open === true);
			return el(
				"details",
				{ open, style: S.section, onToggle: (e) => setOpen(e.target.open) },
				el("summary", { style: S.summary }, props.title, props.badge ? el("span", { style: { ...S.chip, marginLeft: 8 } }, props.badge) : null),
				open ? el("div", { style: { paddingTop: 2 } }, props.children) : null,
			);
		}
		const SEP = () => el("span", { style: { width: 1, height: 18, background: "var(--dsw-alias-border-l2)", margin: "0 4px" } });

		// ── 主组件 ──────────────────────────────────────────────────────────
		function ChunyuSection() {
			const [view, setView] = React.useState(null);
			const [cfg, setCfg] = React.useState(null);
			const [saved, setSaved] = React.useState(null);
			const [busy, setBusy] = React.useState(false);
			const [manualMinutes, setManualMinutes] = React.useState(0);
			const [newWsId, setNewWsId] = React.useState("");
			const [msg, setMsg] = React.useState("");
			const [err, setErr] = React.useState("");
			const [confirmReset, setConfirmReset] = React.useState(false);

			const rpc = async (endpoint, payload) => {
				let conn;
				try { conn = ctxRef.current && ctxRef.current.get("connection"); } catch { conn = undefined; }
				if (!conn || !conn.rpc || typeof conn.rpc.call !== "function") throw new Error("RPC 通道不可用（请确认 DSH 正在运行）");
				const result = await conn.rpc.call("/api", "chunyu", { endpoint, ...(payload || {}) }, undefined);
				if (!result || result.ok !== true) throw new Error((result && result.error && result.error.message) || "RPC 调用失败");
				return result.value;
			};

			const run = async (endpoint, payload, done) => {
				setBusy(true);
				setErr("");
				setMsg("");
				try {
					const value = await rpc(endpoint, payload);
					done?.(value);
				} catch (error) {
					setErr(String((error && error.message) || error).slice(0, 300));
				} finally {
					setBusy(false);
				}
			};

			const load = () => run("state", null, (value) => {
				setView(value);
				setCfg(value.config);
				setSaved(value.config);
			});

			React.useEffect(() => { load(); }, []);

			if (!cfg) {
				return el("div", { style: S.wrap }, el("div", { style: S.hint }, err || "正在加载蠢鱼优化…"));
			}

			const edit = (mutator) => {
				setCfg((prev) => {
					const next = clone(prev);
					mutator(next);
					return next;
				});
			};
			const dirty = saved && JSON.stringify(cfg) !== JSON.stringify(saved);
			const status = view.status || {};
			const selection = (view.status && view.status.selection) || {};
			const band = (view.status && view.status.band) || {};

			const save = (apply) => run("save", { config: cfg, apply: apply === true }, (value) => {
				if (value.config) { setCfg(value.config); setSaved(value.config); }
				setView((prev) => ({ ...(prev || {}), status: value.status, surfcore: value.surfcore || (prev && prev.surfcore) }));
				const applied = value.applied && Array.isArray(value.applied.results) ? `，应用 ${value.applied.results.length} 个会话` : "";
				setMsg(`已保存${applied}`);
			});

			const applyNow = () => run("apply", null, (value) => {
				setView((prev) => ({ ...(prev || {}), status: value.status }));
				const n = Array.isArray(value.results) ? value.results.length : 0;
				setMsg(`已应用到 ${n} 个会话`);
			});

			const switchNow = (provider, model, minutes) => run("switch", { provider, model, minutes, scope: cfg.manual.scope || "global" }, (value) => {
				if (value.config) { setCfg(value.config); setSaved(value.config); }
				setView((prev) => ({ ...(prev || {}), status: value.status }));
				setMsg(`已切到 ${provider}/${model}`);
			});

			const clearManual = () => run("clear-manual", null, (value) => {
				if (value.config) { setCfg(value.config); setSaved(value.config); }
				setView((prev) => ({ ...(prev || {}), status: value.status }));
				setMsg("已取消手动固定");
			});

			const surfcoreNow = () => run("surfcore", { apply: true }, (value) => {
				setView((prev) => ({ ...(prev || {}), surfcore: value.surfcore }));
				setMsg(value.result && value.result.ok ? `SurfCore 已写回：${value.result.file}` : "SurfCore 未写回（已关闭或失败）");
			});

			const doReset = () => {
				if (!confirmReset) { setConfirmReset(true); return; }
				setConfirmReset(false);
				run("reset", null, (value) => {
					setCfg(value.config);
					setSaved(value.config);
					setView((prev) => ({ ...(prev || {}), status: value.status }));
					setMsg("已恢复默认配置");
				});
			};

			const workspaceOptions = (() => {
				const rows = (view.workspaces || []).map((w) => ({ value: w.id, label: `${w.title || w.id} — ${w.path || ""}` }));
				return rows;
			})();
			const presetOptions = (() => {
				const ids = (view.presets || []).map((p) => ({ value: p.id, label: p.id + (p.broken ? "（不可用）" : "") }));
				if (!ids.length) return [{ value: "", label: "（暂无）" }];
				return ids;
			})();
			const modelOptions = (() => {
				const cat = view.catalog || [];
				const rows = cat.map((m) => ({ value: `${m.provider}|${m.model}`, label: `${m.name || m.model} · ${m.provider}` }));
				return rows.length ? rows : [{ value: "", label: "（模型目录为空）" }];
			})();

			// 状态概览
			const overview = el(Section, { title: "运行状态", open: true },
				el("div", { style: S.row },
					el("span", { style: S.chip }, cfg.enabled ? "已启用" : "已停用"),
					el("span", { style: S.chip }, `时段：${band.label || "—"}`),
					el("span", { style: S.chip }, `策略：${selection.policy || "—"}`),
					el("span", { style: S.chip }, selection.provider ? `当前：${selection.provider}/${selection.model}` : "当前：未解析"),
					view.status && view.status.manual ? el("span", { style: S.chip }, `手动固定：${view.status.manual.provider}/${view.status.manual.model}`) : null,
				),
				selection.reason ? el("div", { style: S.hint }, `判定理由：${selection.reason}`) : null,
				view.status && view.status.lastApply ? el("div", { style: S.hint }, `上次应用：${view.status.lastApply.surface} → ${view.status.lastApply.selection ? view.status.lastApply.selection.provider + "/" + view.status.lastApply.selection.model : "—"}${view.status.lastApply.preset ? " · 预设 " + view.status.lastApply.preset : ""}（${new Date(view.status.lastApply.at).toLocaleTimeString("zh-CN", { hour12: false })}）`) : null,
				view.status && view.status.lastError ? el("div", { style: S.error }, view.status.lastError) : null,
				el("div", { style: S.row },
					el("button", { style: S.btn, disabled: busy, onClick: () => save(true) }, "保存并应用到现在所有会话"),
					el("button", { style: S.btnGhost, disabled: busy, onClick: applyNow }, "仅应用"),
					el("button", { style: S.btnGhost, disabled: busy, onClick: load }, "重新读取"),
					el("button", { style: S.btnWarn, disabled: busy, onClick: doReset }, confirmReset ? "再点一次：确认恢复默认" : "恢复默认配置"),
				),
				el("div", { style: S.hint }, `配置：${view.status && view.status.configPath ? view.status.configPath : "~/.dsh/chunyu-optimize/config.json"}`),
			);

			// 总开关 + 时段
			const timeSection = el(Section, { title: "时段与自动切换", badge: cfg.enabled ? "开" : "关" },
				el(Field, { label: "总开关" },
					el(Check, { checked: cfg.enabled, label: "启用蠢鱼优化", onChange: (v) => edit((c) => { c.enabled = v }) }),
				),
				el(Field, { label: "时段模式" },
					el(Select, {
						value: cfg.time.mode, width: 220,
						options: [
							{ value: "peak-valley", label: "峰谷（按起止时间）" },
							{ value: "custom", label: "自定义时段表" },
							{ value: "always-local", label: "始终本地" },
							{ value: "always-online", label: "始终在线" },
						],
						onChange: (v) => edit((c) => { c.time.mode = v }),
					}),
				),
				cfg.time.mode === "peak-valley" ? el("div", { style: S.row },
					el("span", { style: S.label }, "谷时区间"),
					el(TextBox, { value: cfg.time.valleyStart, width: 80, placeholder: "00:30", onChange: (v) => edit((c) => { c.time.valleyStart = v }) }),
					el("span", { style: S.hint }, "→"),
					el(TextBox, { value: cfg.time.valleyEnd, width: 80, placeholder: "08:30", onChange: (v) => edit((c) => { c.time.valleyEnd = v }) }),
					el("span", { style: S.hint }, "跨零点自动识别；谷时之外算峰时"),
				) : null,
				el(Field, { label: "峰时策略" }, el(Select, { value: cfg.time.peakPolicy, options: POLICY, onChange: (v) => edit((c) => { c.time.peakPolicy = v }) })),
				el(Field, { label: "谷时策略" }, el(Select, { value: cfg.time.valleyPolicy, options: POLICY, onChange: (v) => edit((c) => { c.time.valleyPolicy = v }) })),
				el(Field, { label: "跨时段刷新默认模型" },
					el(Check, { checked: cfg.time.boundaryRefresh, label: "每分钟检查，跨段自动刷新", onChange: (v) => edit((c) => { c.time.boundaryRefresh = v }) }),
				),
				cfg.time.mode === "custom" ? el("div", { style: S.card },
					el("div", { style: S.cardTitle }, "自定义时段表"),
					el("div", { style: S.sub }, "从上到下匹配，命中第一条即生效；不填星期 = 每天。起止相同视为不生效。"),
					cfg.time.custom.map((w, i) => el("div", { key: w.id || i, style: S.row },
						el(TextBox, { value: w.label, width: 96, placeholder: "名称", onChange: (v) => edit((c) => { c.time.custom[i].label = v }) }),
						el(TextBox, { value: w.start, width: 66, placeholder: "00:00", onChange: (v) => edit((c) => { c.time.custom[i].start = v }) }),
						el("span", { style: S.hint }, "→"),
						el(TextBox, { value: w.end, width: 66, placeholder: "08:00", onChange: (v) => edit((c) => { c.time.custom[i].end = v }) }),
						el(Select, {
							value: w.policy, width: 150, options: POLICY,
							onChange: (v) => edit((c) => { c.time.custom[i].policy = v }),
						}),
						SEP(),
						DAYS.map((d) => el("label", { key: d.value, style: { fontSize: 12, display: "inline-flex", alignItems: "center", gap: 2 } },
							el("input", {
								type: "checkbox", checked: (w.days || []).includes(d.value),
								onChange: (e) => edit((c) => {
									const days = new Set(c.time.custom[i].days || []);
									if (e.target.checked) days.add(d.value); else days.delete(d.value);
									c.time.custom[i].days = Array.from(days).sort((a, b) => a - b);
								}),
							}),
							d.label,
						)),
						el("button", { style: S.btnWarn, onClick: () => edit((c) => { c.time.custom.splice(i, 1) }) }, "删"),
					)),
					el("button", {
						style: S.btnGhost,
						onClick: () => edit((c) => { c.time.custom.push({ id: `w${c.time.custom.length + 1}`, label: "新时段", days: [], start: "08:30", end: "18:00", policy: "online" }) }),
					}, "+ 加一个时段"),
				) : null,
			);

			// 模型池
			const modelSection = el(Section, { title: "模型池（本地 / 在线）" },
				el("div", { style: S.sub }, "本地列表的第一个（或「首选」）会作为本地默认；上下文长度只影响预设里的压缩预算提示，不会改 Ollama 的 num_ctx。"),
				el("div", { style: S.card },
					el("div", { style: S.cardTitle }, "本地模型"),
					cfg.models.local.map((m, i) => el("div", { key: i, style: S.row },
						el(TextBox, { value: m.provider, width: 130, placeholder: "provider", onChange: (v) => edit((c) => { c.models.local[i].provider = v }) }),
						el(TextBox, { value: m.model, width: 200, placeholder: "model", onChange: (v) => edit((c) => { c.models.local[i].model = v }) }),
						el(TextBox, { value: m.label, width: 120, placeholder: "别名", onChange: (v) => edit((c) => { c.models.local[i].label = v }) }),
						el(NumBox, { value: m.contextTokens, width: 100, min: 2048, max: 262144, onChange: (v) => edit((c) => { c.models.local[i].contextTokens = v }) }),
						el("button", { style: S.btnWarn, onClick: () => edit((c) => { c.models.local.splice(i, 1) }) }, "删"),
					)),
					el("button", { style: S.btnGhost, onClick: () => edit((c) => { c.models.local.push({ provider: "ollama-local", model: "", label: "", contextTokens: 32768 }) }) }, "+ 加本地模型"),
					el(Field, { label: "首选本地" },
						el(Select, {
							value: cfg.models.prefer.local,
							options: cfg.models.local.map((m, i) => ({ value: i, label: `${i + 1}. ${m.label || m.model || "未填"}` })),
							onChange: (v) => edit((c) => { c.models.prefer.local = Number(v) }),
						}),
					),
				),
				el("div", { style: S.card },
					el("div", { style: S.cardTitle }, "在线模型"),
					cfg.models.online.map((m, i) => el("div", { key: i, style: S.row },
						el(TextBox, { value: m.provider, width: 130, placeholder: "provider", onChange: (v) => edit((c) => { c.models.online[i].provider = v }) }),
						el(TextBox, { value: m.model, width: 200, placeholder: "model", onChange: (v) => edit((c) => { c.models.online[i].model = v }) }),
						el(TextBox, { value: m.label, width: 160, placeholder: "别名", onChange: (v) => edit((c) => { c.models.online[i].label = v }) }),
						el("button", { style: S.btnWarn, onClick: () => edit((c) => { c.models.online.splice(i, 1) }) }, "删"),
					)),
					el("button", { style: S.btnGhost, onClick: () => edit((c) => { c.models.online.push({ provider: "ds-vision", model: "", label: "" }) }) }, "+ 加在线模型"),
					el(Field, { label: "首选在线" },
						el(Select, {
							value: cfg.models.prefer.online,
							options: cfg.models.online.map((m, i) => ({ value: i, label: `${i + 1}. ${m.label || m.model || "未填"}` })),
							onChange: (v) => edit((c) => { c.models.prefer.online = Number(v) }),
						}),
					),
				),
				el("div", { style: S.card },
					el("div", { style: S.cardTitle }, "本地失败回退"),
					el(Field, { label: "启用回退" },
						el(Check, { checked: cfg.fallback.enabled, label: "本地请求失败时切在线重试", onChange: (v) => edit((c) => { c.fallback.enabled = v }) }),
					),
					el(Field, { label: "回退目标" },
						el(TextBox, { value: cfg.fallback.targetProvider, width: 140, placeholder: "留空=首选在线 provider", onChange: (v) => edit((c) => { c.fallback.targetProvider = v }) }),
						el(TextBox, { value: cfg.fallback.targetModel, width: 200, placeholder: "留空=首选在线 model", onChange: (v) => edit((c) => { c.fallback.targetModel = v }) }),
					),
					el(Field, { label: "回退冷却（毫秒）" },
						el(NumBox, { value: cfg.fallback.cooldownMs, min: 1000, max: 3600000, step: 1000, onChange: (v) => edit((c) => { c.fallback.cooldownMs = v }) }),
					),
				),
			);

			// 手动切换
			const manualSection = el(Section, { title: "手动切换模型" },
				el("div", { style: S.sub }, "手动固定优先于时段的自动判定；可设自动过期。会话里的工具调用与预设不受影响（除非在续接里开着 auto）。"),
				el(Field, { label: "目标模型" },
					el(Select, {
						value: cfg.manual.provider && cfg.manual.model ? `${cfg.manual.provider}|${cfg.manual.model}` : "",
						width: 320, options: [{ value: "", label: "（未选）" }, ...modelOptions],
						onChange: (v) => {
							const hit = (view.catalog || []).find((m) => `${m.provider}|${m.model}` === v);
							edit((c) => { c.manual.provider = hit ? hit.provider : ""; c.manual.model = hit ? hit.model : "" });
						},
					}),
				),
				el(Field, { label: "作用范围" },
					el(Select, {
						value: cfg.manual.scope || "global", width: 220,
						options: [{ value: "global", label: "全局" }, ...workspaceOptions.map((w) => ({ value: w.value, label: `工作区：${w.label}` }))],
						onChange: (v) => edit((c) => { c.manual.scope = v }),
					}),
				),
				el(Field, { label: "持续（分钟，0=不过期）" },
					el(NumBox, { value: manualMinutes, min: 0, max: 10080, onChange: setManualMinutes }),
				),
				el("div", { style: S.row },
					el("button", {
						style: S.btn, disabled: busy || !cfg.manual.provider || !cfg.manual.model,
						onClick: () => switchNow(cfg.manual.provider, cfg.manual.model, manualMinutes),
					}, "立即切换"),
					el("button", { style: S.btnGhost, disabled: busy, onClick: clearManual }, "取消手动固定"),
				),
			);

			// 会话续接
			const contSection = el(Section, { title: "会话续接与预设匹配" },
				el(Field, { label: "总开关" }, el(Check, { checked: cfg.continuation.enabled, label: "启用会话续接", onChange: (v) => edit((c) => { c.continuation.enabled = v }) })),
				el(Field, { label: "应用模型" }, el(Check, { checked: cfg.continuation.applyModel, label: "新会话按当前策略切模型", onChange: (v) => edit((c) => { c.continuation.applyModel = v }) })),
				el(Field, { label: "应用预设" }, el(Check, { checked: cfg.continuation.applyPreset, label: "按模型类型自动选预设", onChange: (v) => edit((c) => { c.continuation.applyPreset = v }) })),
				el("div", { style: S.card },
					el("div", { style: S.cardTitle }, "工作区会话（默认创造模式）"),
					el(Field, { label: "模式" }, el(Select, { value: cfg.continuation.workspace.mode, options: MODE, onChange: (v) => edit((c) => { c.continuation.workspace.mode = v }) })),
					el(Field, { label: "本地预设" }, el(Select, { value: cfg.continuation.workspace.localPreset, width: 220, options: [{ value: "", label: "（不切）" }, ...presetOptions], onChange: (v) => edit((c) => { c.continuation.workspace.localPreset = v }) })),
					el(Field, { label: "在线预设" }, el(Select, { value: cfg.continuation.workspace.onlinePreset, width: 220, options: [{ value: "", label: "（不切）" }, ...presetOptions], onChange: (v) => edit((c) => { c.continuation.workspace.onlinePreset = v }) })),
				),
				el("div", { style: S.card },
					el("div", { style: S.cardTitle }, "QQ 续接"),
					el(Field, { label: "启用" }, el(Check, { checked: cfg.continuation.qq.enabled, label: "识别 QQ 会话并应用", onChange: (v) => edit((c) => { c.continuation.qq.enabled = v }) })),
					el(Field, { label: "识别特征（预设前缀）" }, el(TextBox, { value: (cfg.continuation.qq.match || []).join(","), width: 260, placeholder: "qq-chat", onChange: (v) => edit((c) => { c.continuation.qq.match = v.split(",").map((x) => x.trim()).filter(Boolean) }) })),
					el(Field, { label: "模式" }, el(Select, { value: cfg.continuation.qq.mode, options: SURFACE_MODE, onChange: (v) => edit((c) => { c.continuation.qq.mode = v }) })),
					el(Field, { label: "本地预设" }, el(Select, { value: cfg.continuation.qq.localPreset, width: 220, options: [{ value: "", label: "（不切）" }, ...presetOptions], onChange: (v) => edit((c) => { c.continuation.qq.localPreset = v }) })),
					el(Field, { label: "在线预设（二代仿真卡）" }, el(Select, { value: cfg.continuation.qq.onlinePreset, width: 220, options: [{ value: "", label: "（不切）" }, ...presetOptions], onChange: (v) => edit((c) => { c.continuation.qq.onlinePreset = v }) })),
				),
				el("div", { style: S.card },
					el("div", { style: S.cardTitle }, "B 站续接"),
					el(Field, { label: "启用" }, el(Check, { checked: cfg.continuation.bili.enabled, label: "识别 B 站会话并应用", onChange: (v) => edit((c) => { c.continuation.bili.enabled = v }) })),
					el(Field, { label: "识别特征（预设前缀）" }, el(TextBox, { value: (cfg.continuation.bili.match || []).join(","), width: 260, placeholder: "bili", onChange: (v) => edit((c) => { c.continuation.bili.match = v.split(",").map((x) => x.trim()).filter(Boolean) }) })),
					el(Field, { label: "模式" }, el(Select, { value: cfg.continuation.bili.mode, options: SURFACE_MODE, onChange: (v) => edit((c) => { c.continuation.bili.mode = v }) })),
					el(Field, { label: "本地预设" }, el(Select, { value: cfg.continuation.bili.localPreset, width: 220, options: [{ value: "", label: "（不切）" }, ...presetOptions], onChange: (v) => edit((c) => { c.continuation.bili.localPreset = v }) })),
					el(Field, { label: "在线预设" }, el(Select, { value: cfg.continuation.bili.onlinePreset, width: 220, options: [{ value: "", label: "（不切）" }, ...presetOptions], onChange: (v) => edit((c) => { c.continuation.bili.onlinePreset = v }) })),
				),
			);

			// 工作区覆盖
			const wsKeys = Object.keys(cfg.workspaces || {});
			const wsSection = el(Section, { title: "工作区覆盖", badge: wsKeys.length ? String(wsKeys.length) : "" },
				el("div", { style: S.sub }, "按工作区固定模型 / 预设 / 续接模式；覆盖优先于全局时段策略（手动固定仍最高）。"),
				wsKeys.map((id) => {
					const ws = cfg.workspaces[id] || {};
					return el("div", { key: id, style: S.card },
						el("div", { style: S.row },
							el("span", { style: S.cardTitle }, id),
							el(Select, {
								value: ws.mode || "", width: 170,
								options: [{ value: "", label: "跟随全局" }, ...SURFACE_MODE],
								onChange: (v) => edit((c) => { c.workspaces[id].mode = v }),
							}),
							el("button", { style: S.btnWarn, onClick: () => edit((c) => { delete c.workspaces[id] }) }, "移除"),
						),
						el("div", { style: S.row },
							el(TextBox, { value: ws.provider || "", width: 130, placeholder: "provider（留空=不固定）", onChange: (v) => edit((c) => { c.workspaces[id].provider = v }) }),
							el(TextBox, { value: ws.model || "", width: 180, placeholder: "model", onChange: (v) => edit((c) => { c.workspaces[id].model = v }) }),
						),
						el("div", { style: S.row },
							el(Select, { value: ws.localPreset || "", width: 220, options: [{ value: "", label: "本地预设：跟随全局" }, ...presetOptions], onChange: (v) => edit((c) => { c.workspaces[id].localPreset = v }) }),
							el(Select, { value: ws.onlinePreset || "", width: 220, options: [{ value: "", label: "在线预设：跟随全局" }, ...presetOptions], onChange: (v) => edit((c) => { c.workspaces[id].onlinePreset = v }) }),
						),
					);
				}),
				el("div", { style: S.row },
					el(Select, {
						value: "", width: 320,
						options: [{ value: "", label: "选择要覆盖的工作区…" }, ...workspaceOptions.filter((w) => !(w.value in (cfg.workspaces || {})))],
						onChange: (v) => { if (!v) return; edit((c) => { c.workspaces[v] = { mode: "", localPreset: "", onlinePreset: "", provider: "", model: "" } }) },
					}),
					el(TextBox, { value: newWsId, width: 220, placeholder: "或手填工作区 id", onChange: setNewWsId }),
					el("button", {
						style: S.btnGhost,
						onClick: () => { const id = newWsId.trim(); if (!id) return; edit((c) => { c.workspaces[id] = c.workspaces[id] || { mode: "", localPreset: "", onlinePreset: "", provider: "", model: "" } }); setNewWsId("") },
					}, "添加"),
				),
			);

			// 预设
			const presetCard = (key, title) => {
				const p = cfg.presets[key];
				return el("div", { style: S.card },
					el("div", { style: S.row },
						el("span", { style: S.cardTitle }, title),
						el(Check, { checked: p.enabled, label: "注册", onChange: (v) => edit((c) => { c.presets[key].enabled = v }) }),
						el(TextBox, { value: p.id, width: 190, placeholder: "预设 id", onChange: (v) => edit((c) => { c.presets[key].id = v }) }),
						el(TextBox, { value: p.name, width: 170, placeholder: "显示名", onChange: (v) => edit((c) => { c.presets[key].name = v }) }),
					),
					el(Field, { label: "人设" }, el(Select, { value: p.persona, width: 190, options: PERSONA, onChange: (v) => edit((c) => { c.presets[key].persona = v }) })),
					el(Field, { label: "压缩 maxTokens" }, el(NumBox, { value: p.compaction.maxTokens, min: 512, max: 65536, step: 256, onChange: (v) => edit((c) => { c.presets[key].compaction.maxTokens = v }) })),
					el(Field, { label: "压缩 headroomTokens" }, el(NumBox, { value: p.compaction.headroomTokens, min: 512, max: 65536, step: 256, onChange: (v) => edit((c) => { c.presets[key].compaction.headroomTokens = v }) })),
					el(Field, { label: "触发阈值 / 保留比例" },
						el(NumBox, { value: p.compaction.thresholdRatio, min: 0.3, max: 0.95, step: 0.01, onChange: (v) => edit((c) => { c.presets[key].compaction.thresholdRatio = v }) }),
						el(NumBox, { value: p.compaction.retainRatio, min: 0.02, max: 0.5, step: 0.01, onChange: (v) => edit((c) => { c.presets[key].compaction.retainRatio = v }) }),
					),
					el(Field, { label: "工具结果裁剪" },
						el(Check, { checked: p.pruner.enabled, label: "启用", onChange: (v) => edit((c) => { c.presets[key].pruner.enabled = v }) }),
						el(NumBox, { value: p.pruner.thresholdChars, min: 1024, max: 262144, step: 1024, onChange: (v) => edit((c) => { c.presets[key].pruner.thresholdChars = v }) }),
						el(NumBox, { value: p.pruner.headChars, min: 256, max: 131072, step: 512, onChange: (v) => edit((c) => { c.presets[key].pruner.headChars = v }) }),
						el(NumBox, { value: p.pruner.tailChars, min: 128, max: 65536, step: 256, onChange: (v) => edit((c) => { c.presets[key].pruner.tailChars = v }) }),
					),
					el(Field, { label: "工具" },
						el(Check, { checked: p.tools.web, label: "网页", onChange: (v) => edit((c) => { c.presets[key].tools.web = v }) }),
						el(Check, { checked: p.tools.fs, label: "文件", onChange: (v) => edit((c) => { c.presets[key].tools.fs = v }) }),
					),
					el(Field, { label: "排序" }, el(NumBox, { value: p.order, min: 1, max: 999, onChange: (v) => edit((c) => { c.presets[key].order = v }) })),
				);
			};
			const presetSection = el(Section, { title: "本地预设（随插件注册）" },
				el("div", { style: S.sub }, "保存后自动重新注册；预设 id 改动会让工作区/QQ 的映射失效，改完记得同步上面对应的下拉。"),
				presetCard("localChat", "聊天预设"),
				presetCard("localWork", "工作预设"),
				el("div", { style: S.hint }, `当前已注册：${(view.presets || []).map((p) => p.id).join("、") || "（无）"}`),
			);

			// SurfCore
			const sc = cfg.surfcore;
			const scStatus = view.surfcore || {};
			const levelRow = (label, values, group) => el("tr", null,
				el("td", { style: S.td }, label),
				el("td", { style: S.td }, el(Select, {
					value: values.persona, width: 130, options: LEVEL,
					onChange: (v) => edit((c) => { c.surfcore[group][labelKey(label)].persona = v }),
				})),
				el("td", { style: S.td }, el(Select, {
					value: values.memory, width: 130, options: LEVEL,
					onChange: (v) => edit((c) => { c.surfcore[group][labelKey(label)].memory = v }),
				})),
			);
			const labelKey = (label) => (label === "QQ" ? "qq" : "bili");
			const tableRow = (level) => el("tr", null,
				el("td", { style: S.td }, level),
				el("td", { style: S.td }, el(NumBox, { value: sc.levelTable[level].personaChars, min: 0, max: 20000, step: 100, onChange: (v) => edit((c) => { c.surfcore.levelTable[level].personaChars = v }) })),
				el("td", { style: S.td }, el(NumBox, { value: sc.levelTable[level].memoryChars, min: 0, max: 8000, step: 100, onChange: (v) => edit((c) => { c.surfcore.levelTable[level].memoryChars = v }) })),
			);
			const surfSection = el(Section, { title: "SurfCore 联动（人设卡 / 记忆卡分级）" },
				el("div", { style: S.sub }, "直接改写 ~/.dsh/surfcore/config.json 的 persona 与 memoryCard 两段，其它键与密钥原样保留。SurfCore 每次读取都重新读文件，改完即生效。"),
				el(Field, { label: "启用联动" }, el(Check, { checked: sc.enabled, label: "允许蠢鱼优化改 SurfCore 配置", onChange: (v) => edit((c) => { c.surfcore.enabled = v }) })),
				el(Field, { label: "保存时写回" }, el(Check, { checked: sc.autoApply, label: "保存配置时自动应用", onChange: (v) => edit((c) => { c.surfcore.autoApply = v }) })),
				el(Field, { label: "本地自动降档" }, el(Check, { checked: sc.autoDowngradeOnLocal, label: "当前选中本地模型时用「本地档」", onChange: (v) => edit((c) => { c.surfcore.autoDowngradeOnLocal = v }) })),
				el(Field, { label: "配置路径" }, el(TextBox, { value: sc.configPath, width: 360, placeholder: "留空=~/.dsh/surfcore/config.json", onChange: (v) => edit((c) => { c.surfcore.configPath = v }) })),
				el("div", { style: S.card },
					el("div", { style: S.cardTitle }, "常规档（在线模型）"),
					el("table", { style: S.table },
						el("thead", null, el("tr", null, el("th", { style: S.th }, "平台"), el("th", { style: S.th }, "人设"), el("th", { style: S.th }, "记忆卡"))),
						el("tbody", null, levelRow("QQ", sc.levels.qq, "levels"), levelRow("B站", sc.levels.bili, "levels")),
					),
				),
				el("div", { style: S.card },
					el("div", { style: S.cardTitle }, "本地档（本地模型）"),
					el("table", { style: S.table },
						el("thead", null, el("tr", null, el("th", { style: S.th }, "平台"), el("th", { style: S.th }, "人设"), el("th", { style: S.th }, "记忆卡"))),
						el("tbody", null, levelRow("QQ", sc.localLevels.qq, "localLevels"), levelRow("B站", sc.localLevels.bili, "localLevels")),
					),
				),
				el("div", { style: S.card },
					el("div", { style: S.cardTitle }, "档位字符预算"),
					el("table", { style: S.table },
						el("thead", null, el("tr", null, el("th", { style: S.th }, "档位"), el("th", { style: S.th }, "人设字符"), el("th", { style: S.th }, "记忆卡字符"))),
						el("tbody", null, ["off", "compact", "standard", "full"].map((lv) => tableRow(lv))),
					),
				),
				el("div", { style: S.row },
					el("button", { style: S.btnGhost, disabled: busy, onClick: surfcoreNow }, "立即写回 SurfCore"),
					el("span", { style: S.hint }, scStatus.exists ? `文件：${scStatus.file}${scStatus.localNow ? "（当前判为本地档）" : "（当前判为常规档）"}` : "尚未发现 SurfCore 配置文件"),
				),
			);

			return el("div", { style: S.wrap },
				el("div", { style: S.row },
					el("span", { style: { fontSize: 15, fontWeight: 600 } }, NS_LABEL),
					el("span", { style: S.hint }, "本地部署优化：按工作区/时段切模型、预设自动匹配、会话续接、SurfCore 人设与记忆分级"),
				),
				err ? el("div", { style: S.error }, err) : null,
				msg ? el("div", { style: S.ok }, msg) : null,
				overview,
				timeSection,
				modelSection,
				manualSection,
				contSection,
				wsSection,
				presetSection,
				surfSection,
				el("div", { style: S.bar },
					el("button", { style: S.btn, disabled: busy || !dirty, onClick: () => save(false) }, dirty ? "保存配置" : "已保存"),
					el("button", { style: S.btnGhost, disabled: busy || !dirty, onClick: () => setCfg(saved) }, "丢弃更改"),
					dirty ? el("span", { style: S.dirty }, "有未保存的修改") : el("span", { style: S.hint }, "所有修改都写在本机配置里，重启不丢"),
					busy ? el("span", { style: S.hint }, "处理中…") : null,
				),
			);
		}

		let ctxRef = { current: null };

		function apply(ctx) {
			ctxRef.current = ctx;
			try {
				ctx.slots.inject("settings.section", function* () {
					yield ctx.slots.register(
						{ name: "settings.section", id: "dsh-chunyu-optimize", order: 21, label: () => NS_LABEL },
						ChunyuSection,
					);
				});
			} catch (e) {
				console.warn("[dsh-chunyu-optimize] settings.section slot unavailable", e);
			}
		}

		exports.inject = ["slots"];
		exports.apply = apply;
		return module.exports;
	},
});