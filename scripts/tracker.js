export const MOD_ID = "preload-tracker";
import { LT } from "./localization.js";

// Track whether we are currently within a preload run on this client
let PT_CURRENT_RUN = { active: false, sceneId: null };

// Audio preload tracking (Playlist Sound "Preload")
let PT_AUDIO_CURRENT_RUN = { active: false, runId: null, src: null, label: null };
let PT_AUDIO_LAST_START = { src: null, ts: 0 };
const PT_AUDIO_TRACKED_SRCS = new Map(); // src => { runId, label }


/*	=======================================================================
    Simple debuig logger to style console messages
    DL("msg") => info
    DL(2, "msg") => warn
    DL(3, "msg") => error
======================================================================= */
export function DL(intLogType, stringLogMsg, objObject = null) {
	// Get Timestamps
	const now = new Date();
	const timestamp = now.toTimeString().split(' ')[0]; // "HH:MM:SS"
	
	// Handle the case where the first argument is a string
	if (typeof intLogType === "string") {
		objObject = stringLogMsg; // Shift arguments
		stringLogMsg = intLogType;
		intLogType = 1; // Default log type to 'all'
	}
	const debugLevel = game.settings.get(MOD_ID, "debugLevel");

	// Map debugLevel setting to numeric value for comparison
	const levelMap = {
		"none": 4,
		"error": 3,
		"warn": 2,
		"all": 1
	};

	const currentLevel = levelMap[debugLevel] || 4; // Default to 'none' if debugLevel is undefined

	// Check if the log type should be logged based on the current debug level
	if (intLogType < currentLevel) return;

	// Capture stack trace to get file and line number
	const stack = new Error().stack.split("\n");
	let fileInfo = "Unknown Source";
	for (let i = 2; i < stack.length; i++) {
		const line = stack[i].trim();
		const fileInfoMatch = line.match(/(\/[^)]+):(\d+):(\d+)/); // Match file path and line number
		if (fileInfoMatch) {
			const [, filePath, lineNumber] = fileInfoMatch;
			const fileName = filePath.split("/").pop(); // Extract just the file name
			fileInfo = `${fileName}:${lineNumber}`;
		}
	}

	// Prepend the file and line info to the log message
	const formattedLogMsg = `[${fileInfo}] ${stringLogMsg}`;
	
	if (objObject) {
		switch (intLogType) {
			case 1: // Info/Log (all)
				console.log(`%cPreload Tracker [${timestamp}] | ${formattedLogMsg}`, "color: #7e56db; font-weight: bold;", objObject);
				break;
			case 2: // Warning
				console.log(`%cPreload Tracker [${timestamp}] | WARNING: ${formattedLogMsg}`, "color: orange; font-weight: bold;", objObject);
				break;
			case 3: // Critical/Error
				console.log(`%cPreload Tracker [${timestamp}] | ERROR: ${formattedLogMsg}`, "color: red; font-weight: bold;", objObject);
				break;
			default:
				console.log(`%cPreload Tracker [${timestamp}] | ${formattedLogMsg}`, "color: aqua; font-weight: bold;", objObject);
		}
	} else {
		switch (intLogType) {
			case 1: // Info/Log (all)
				console.log(`%cPreload Tracker [${timestamp}] | ${formattedLogMsg}`, "color: #7e56db; font-weight: bold;");
				break;
			case 2: // Warning
				console.log(`%cPreload Tracker [${timestamp}] | WARNING: ${formattedLogMsg}`, "color: orange; font-weight: bold;");
				break;
			case 3: // Critical/Error
				console.log(`%cPreload Tracker [${timestamp}] | ERROR: ${formattedLogMsg}`, "color: red; font-weight: bold;");
				break;
			default:
				console.log(`%cPreload Tracker [${timestamp}] | ${formattedLogMsg}`, "color: #7e56db; font-weight: bold;");
		}
	}
}

/* =====================================================================================
	PRELOAD TRACKER UI 
===================================================================================== */
class PreloadTrackerApp extends foundry.applications.api.ApplicationV2 {
	static _instance = null;
	static _stylesInjected = false;
	
	static getInstance() {
		if (!this._instance) this._instance = new PreloadTrackerApp();
		return this._instance;
	}

	constructor() {
		super({
			id: "preload-status",
			window: {
				title: LT.title(),
				icon: "fas fa-cloud-download-alt",
				modal: false
			},
			width: 820
		});

		this.sceneId = null;
		this.sceneName = "";
		this.users = new Map();	// userId => { name, isGM, started, done }
		this.runToken = 0;		// increments each time we start a new preload run
	}

	// Inject CSS styles once
	_ensureStyles() {
        if (PreloadTrackerApp._stylesInjected) return;
        const css = document.createElement("style");
        css.id = "pt-styles";
        css.textContent = `
        @keyframes pt-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .pt-spin { animation: pt-spin 1.6s linear infinite; }
        .pt-green { color: #22c55e; }
        .pt-orange { color: #f59e0b; }
        .pt-mono { opacity: .65; }
        `;
        document.head.appendChild(css);
        PreloadTrackerApp._stylesInjected = true;
	}

	// Set current scene info
	setScene(scene) {
		this.sceneId = scene?.id ?? null;
		this.sceneName = scene?.name ?? "";
	}

	// Start of a new preload "run": clear all per-user status
	startRun(scene) {
		this.setScene(scene);
		this.runToken++;
		for (const [uid, rec] of this.users) {
			rec.started = false;
			rec.done = false;
			rec.pct = 0;
			this.users.set(uid, rec);
		}
	}

	// Ensure this.users has all current users from game.users
	ensureUsersFromGame() {
		for (const u of game.users.contents) {
			if (!this.users.has(u.id)) {
				this.users.set(u.id, { name: u.name, isGM: u.isGM, started: false, done: false, pct: 0 });
			} else {
				const rec = this.users.get(u.id);
				rec.name = u.name;
				rec.isGM = u.isGM;
				this.users.set(u.id, rec);
			}
		}
	}

	// Mark user as started
	markStarted(userId) {
		const rec = this.users.get(userId);
		if (rec) { rec.started = true; this.users.set(userId, rec); }
	}

	// Mark user as done
	markDone(userId) {
		const rec = this.users.get(userId);
		if (rec) { rec.started = true; rec.done = true; rec.pct = 100; this.users.set(userId, rec); }
	}

	// Set user progress percentage
	setProgress(userId, pct) {
		const rec = this.users.get(userId);
		if (!rec) return;
		const n = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
		if (n >= (rec.pct ?? 0) || n === 0 || n === 100) {
			rec.pct = n;
			this.users.set(userId, rec);
		}
	}

	// Render overrides
	async _renderHTML(options) {
		this._ensureStyles();
		const root = document.createElement("div");
		root.classList.add("pt-content-root");
		root.appendChild(await this._buildInner());
		return root;
	}

	async _replaceHTML(result, content, options) {
		if (content instanceof HTMLElement) {
			content.replaceChildren(result);
			return content;
		}
		return result;
	}

	/* ===== UI ===== */

	async _buildInner() {
		const wrapper = document.createElement("div");
		wrapper.style.padding = "0.5rem";

		const title = document.createElement("div");
		title.style.fontWeight = "600";
		title.style.marginBottom = "0.25rem";
		title.textContent = this.sceneName ? `${LT.preloading()} ${this.sceneName}` : LT.preloadingScene();
		wrapper.appendChild(title);

		const list = document.createElement("div");
		list.style.display = "flex";
		list.style.flexDirection = "column";
		list.style.gap = "6px";

		// Build rows for ONLINE users only, and compute all-online-done gate
		let allOnlineDone = true;
		const onlineUsers = game.users.contents.filter(u => u.active);

		for (const u of onlineUsers) {
			const row = document.createElement("div");
			row.style.display = "grid";
			row.style.gridTemplateColumns = "1fr auto"; // name | status icon
			row.style.alignItems = "center";
			row.style.gap = "8px";
			row.style.padding = "6px 8px";
			row.style.border = "1px solid #00000020";
			row.style.borderRadius = "8px";
			row.style.background = "#0000000a";

			const rec = this.users.get(u.id) || { started: false, done: false };

			// Track all-online-done
			if (!rec.done) allOnlineDone = false;

			const name = document.createElement("div");
			name.textContent = u.name + (u.isGM ? " (GM)" : "");
			row.appendChild(name);

			const status = document.createElement("div");
			status.style.display = "flex";
			status.style.alignItems = "center";
			status.style.justifyContent = "flex-end";
			status.style.minWidth = "1.25rem";

			if (rec.done) {
				status.innerHTML = `<i class="fas fa-check pt-green" title="${LT.finished()}"></i>`;
			} else if (rec.started) {
				const pct = Math.max(0, Math.min(100, Number(rec.pct ?? 0)));
				status.innerHTML = `
					<i class="fas fa-spinner pt-spin pt-orange" title="${LT.loading()}"></i>
					<span class="pt-mono" style="margin-left: 6px;">${pct}%</span>
				`;
			} else {
				status.innerHTML = `<span class="pt-mono" title="${LT.waiting()}">—</span>`;
			}

			row.appendChild(status);
			list.appendChild(row);
		}

		wrapper.appendChild(list);

		const actions = document.createElement("div");
		actions.style.display = "flex";
		actions.style.justifyContent = "flex-end";
		actions.style.gap = "8px";
		actions.style.marginTop = "10px";

		// Activate button (GM only), disabled until everyone online is done
		if (game.user.isGM && this.sceneId) {
			const activateBtn = document.createElement("button");
			activateBtn.classList.add("button");
			activateBtn.textContent = LT.activate();

			const isActive = game.scenes?.active?.id === this.sceneId;

			// Disable conditions:
			// - scene is already active OR
			// - not all online users are done
			activateBtn.disabled = isActive || !allOnlineDone;

			// Helpful tooltip
			if (isActive) {
				activateBtn.title = LT.alreadyActive();
			} else if (!allOnlineDone) {
				activateBtn.title = LT.activateBtnTitle();
			}

			activateBtn.addEventListener("click", async () => {
				try {
					const sc = game.scenes.get(this.sceneId);
					if (!sc) {
						DL(2, "activate(): scene not found", { id: this.sceneId, name: this.sceneName });
						return;
					}
					DL(`activate(): activating scene "${sc.name}" (${sc.id})`);
					// close window
					await this.close();
					// activate
					await sc.activate();
					
				} catch (e) {
					DL(3, "activate(): failed", e);
					ui.notifications?.error(LT.activateError());
				}
			});

			actions.appendChild(activateBtn);
		}

		const closeBtn = document.createElement("button");
		closeBtn.classList.add("button");
		closeBtn.textContent = LT.close();
		closeBtn.addEventListener("click", () => this.close());
		actions.appendChild(closeBtn);

		wrapper.appendChild(actions);
		return wrapper;
	}
}

/* =====================================================================================
	AUDIO PRELOAD TRACKER UI
===================================================================================== */
class AudioPreloadTrackerApp extends foundry.applications.api.ApplicationV2 {
	static _instance = null;
	static _stylesInjected = false;

	static getInstance() {
		if (!this._instance) this._instance = new AudioPreloadTrackerApp();
		return this._instance;
	}

	constructor() {
		super({
			id: "preload-audio-status",
			window: {
				title: LT.audioTitle(),
				icon: "fas fa-music",
				modal: false
			},
			width: 520,
			height: "auto",
			resizable: true
		});

		this.runId = null;
		this.src = null;
		this.label = "";
		this.users = new Map(); // userId => { name, isGM, started, done }
	}

	// Inject CSS styles once
	_ensureStyles() {
		if (AudioPreloadTrackerApp._stylesInjected) return;

		const css = document.createElement("style");
		css.id = "pt-audio-styles";
		css.textContent = `
			@keyframes pt-spin {
				from { transform: rotate(0deg); }
				to { transform: rotate(360deg); }
			}

			.pt-spin {
				animation: pt-spin 1.6s linear infinite;
			}

			.pt-green {
				color: #22c55e;
			}

			.pt-orange {
				color: #f59e0b;
			}

			.pt-mono {
				opacity: .65;
			}
		`;
		document.head.appendChild(css);

	AudioPreloadTrackerApp._stylesInjected = true;
	}

	// Ensure this.users has all current users from game.users
	ensureUsersFromGame() {
		for (const u of game.users.contents) {
			if (!this.users.has(u.id)) {
				this.users.set(u.id, { name: u.name, isGM: u.isGM, started: false, done: false });
			} else {
				const rec = this.users.get(u.id);
				rec.name = u.name;
				rec.isGM = u.isGM;
				this.users.set(u.id, rec);
			}
		}
	}

	// Start of a new audio preload "run": clear all per-user status
	startRun({ runId, src, label }) {
		this.runId = runId;
		this.src = src;
		this.label = label ?? src ?? "";

		// Default: mark all ACTIVE users as "started" so they show the spinner immediately.
		// They'll flip to "done" when their status arrives.
		const activeUsers = game.users.contents.filter(u => u.active);

		for (const u of activeUsers) {
			if (!this.users.has(u.id)) {
				this.users.set(u.id, { name: u.name, isGM: u.isGM, started: true, done: false });
			} else {
				const rec = this.users.get(u.id);
				rec.name = u.name;
				rec.isGM = u.isGM;
				rec.started = true;
				rec.done = false;
				this.users.set(u.id, rec);
			}
		}

		// Also reset anyone else we might have cached (inactive users)
		for (const [uid, rec] of this.users.entries()) {
			if (activeUsers.some(u => u.id === uid)) continue;
			rec.started = false;
			rec.done = false;
			this.users.set(uid, rec);
		}
	}

	// Mark user as started
	markStarted(userId) {
		const rec = this.users.get(userId);
		if (!rec) return;
		rec.started = true;
		this.users.set(userId, rec);
	}

	// Mark user as done
	markDone(userId) {
		const rec = this.users.get(userId);
		if (!rec) return;
		rec.started = true;
		rec.done = true;
		this.users.set(userId, rec);
	}

	// Check if all active users are done
	_allDone() {
		const activeUsers = game.users.contents.filter(u => u.active);
		if (!activeUsers.length) return false;

		for (const u of activeUsers) {
			const rec = this.users.get(u.id);
			if (!rec?.done) return false;
		}
		return true;
	}

	async _renderHTML(options) {
		this._ensureStyles(); // inject styles
		const root = document.createElement("div");
		root.style.padding = "0.75rem";
		root.appendChild(await this._buildInner());
		return root;
	}

	async _replaceHTML(result, content, options) {
		if (content instanceof HTMLElement) {
			content.replaceChildren(result);
			return content;
		}
		return result;
	}

	// Find a Playlist and Sound by matching src
	_findPlaylistSoundBySrc(src) {
		try {
			if (!src) return null;

			const normalize = (s) => {
				try { return decodeURIComponent(String(s ?? "")).trim().toLowerCase(); }
				catch { return String(s ?? "").trim().toLowerCase(); }
			};

			const target = normalize(src);
			if (!target) return null;

			for (const playlist of (game.playlists?.contents ?? [])) {
				for (const sound of (playlist.sounds?.contents ?? [])) {
					const candidate =
						sound.path ??
						sound.src ??
						sound._source?.path ??
						sound._source?.src ??
						"";

					if (!candidate) continue;

					if (normalize(candidate) === target) {
						return { playlist, sound };
					}
				}
			}
		} catch (e) {
			DL(2, "AudioPreloadTrackerApp._findPlaylistSoundBySrc(): failed", e);
		}
		return null;
	}

	async _buildInner() {
		const wrapper = document.createElement("div");
		wrapper.style.display = "flex";
		wrapper.style.flexDirection = "column";
		wrapper.style.gap = "0.5rem";

		// Title
		const title = document.createElement("div");
		title.style.fontWeight = "600";
		title.textContent = this.label
			? `${LT.preloadingSound()} ${this.label}`
			: LT.preloadingSoundGeneric();
		wrapper.appendChild(title);

		// User list
		const list = document.createElement("div");
		list.style.display = "flex";
		list.style.flexDirection = "column";
		list.style.gap = "6px";

		const activeUsers = game.users.contents.filter(u => u.active);

		if (!activeUsers.length) {
			const none = document.createElement("div");
			none.classList.add("pt-mono");
			none.textContent = LT.noUsers();
			list.appendChild(none);
		} else {
			for (const u of activeUsers) {
				const rec = this.users.get(u.id) ?? {
					name: u.name,
					isGM: u.isGM,
					started: false,
					done: false
				};

				const row = document.createElement("div");
				row.style.display = "grid";
				row.style.gridTemplateColumns = "1fr auto";
				row.style.alignItems = "center";
				row.style.gap = "8px";
				row.style.padding = "6px 8px";
				row.style.border = "1px solid var(--color-border-light-2)";
				row.style.borderRadius = "6px";

				const left = document.createElement("div");
				left.textContent = rec.name + (rec.isGM ? " (GM)" : "");

				const status = document.createElement("div");
				status.className = "pt-status";

				if (rec.done) {
					status.innerHTML = `<i class="fas fa-check pt-green" title="${LT.finished()}"></i>`;
				} else if (rec.started) {
					status.innerHTML = `<i class="fas fa-spinner pt-spin pt-orange" title="${LT.loading()}"></i>`;
				} else {
					status.textContent = "";
				}

				row.appendChild(left);
				row.appendChild(status);
				list.appendChild(row);
			}
		}

		wrapper.appendChild(list);

		// Footer buttons
		const footer = document.createElement("div");
		footer.style.display = "flex";
		footer.style.justifyContent = "flex-end";
		footer.style.gap = "8px";
		footer.style.marginTop = "0.5rem";

		const playBtn = document.createElement("button");
		playBtn.type = "button";
		playBtn.textContent = LT.playBtn();
		playBtn.title = LT.playHint();
		playBtn.disabled = !this._allDone() || !this.src;

		playBtn.addEventListener("click", async () => {
			try {
				if (!this.src) return;

				// Prefer playlist playback so it appears in the Playlists UI and can be stopped there
				const hit = this._findPlaylistSoundBySrc(this.src);
				if (hit?.playlist && hit?.sound) {
					await hit.playlist.playSound(hit.sound);
					await this.close();
					return;
				}

				// Fallback: direct play (won't show in Playlists tab)
				await foundry.audio.AudioHelper.play(
					{ src: this.src, volume: 0.8, loop: false },
					true
				);

				await this.close();

			} catch (e) {
				DL(3, "AudioPreloadTrackerApp._buildInner(): play failed", e);
				ui.notifications?.error(LT.playError());
			}
		});

		const closeBtn = document.createElement("button");
		closeBtn.type = "button";
		closeBtn.textContent = LT.close();
		closeBtn.addEventListener("click", () => this.close());

		footer.appendChild(playBtn);
		footer.appendChild(closeBtn);
		wrapper.appendChild(footer);

		return wrapper;
	}

}

/* =====================================================================================
	SOCKET HANDLERS
===================================================================================== */

// Attempt to extract a percentage from console.log args
function _ptExtractPctFromLogArgs(args) {
	try {
		// Join only stringable parts so we don't hammer performance
		const s = Array.from(args).map(a => (typeof a === "string" ? a : "")).join(" ");
		const m = s.match(/\((\d+(?:\.\d+)?)%\)/);
		if (m) return Number(m[1]);
	} catch {}
	return undefined;
}

// Install a tap on console.log to catch progress messages
function _ptInstallConsoleProgressTap() {
	if (PT_ORIG_CONSOLE_LOG) return; // already installed
	PT_ORIG_CONSOLE_LOG = console.log;
	console.log = function patchedConsoleLog(...args) {
		try {
			if (PT_CURRENT_RUN.active && !game.user.isGM) {
				const pct = _ptExtractPctFromLogArgs(args);
				if (typeof pct === "number") {
					const n = Math.max(0, Math.min(100, Math.round(pct)));
					DL(`console-progress: ${n}% scene=${PT_CURRENT_RUN.sceneId}`);
					emitStatus({ type: "preload-status", sceneId: PT_CURRENT_RUN.sceneId, userId: game.user.id, status: "progress", pct: n });
				}
			}
		} catch (e) {
			DL(2, "console progress tap error", e);
		}
		// Always pass through
		return PT_ORIG_CONSOLE_LOG.apply(this, args);
	};
	DL("console progress tap installed");
}

// Remove the tap when done
function _ptRemoveConsoleProgressTap() {
	if (!PT_ORIG_CONSOLE_LOG) return;
	console.log = PT_ORIG_CONSOLE_LOG;
	PT_ORIG_CONSOLE_LOG = null;
	DL("console progress tap removed");
}

// Emit a preload status message to GMs
function emitStatus(payload) {
	try {
		const channel = `module.${MOD_ID}`;
		DL(`emit: tx ${payload?.status} user=${payload?.userId} scene=${payload?.sceneId} -> ${channel}`);
		game.socket.emit(channel, payload);
	} catch (e) {
		DL(3, "emitStatus(): socket emit failed", e);
	}
}

// Register socket listener for preload status messages\
function registerSocketHandlers() {
	const channel = `module.${MOD_ID}`;
	game.socket.on(channel, async (data) => {
		try {
			if (!data || typeof data !== "object") return;

			// ============================
			// AUDIO START: GM -> all clients
			// ============================
			if (data.type === "audio-preload-start") {

				// Everyone tracks this src for this runId so wrappers can report started/done
				if (data.src && data.runId) {
					PT_AUDIO_TRACKED_SRCS.set(data.src, { runId: data.runId, label: data.label ?? data.src });
					DL(`socket rx audio-preload-start runId=${data.runId} src=${data.src}`);
				}

				// GM does NOT receive their own emit, so nothing else to do here
				return;
			}

			// ============================
			// AUDIO STATUS: clients -> GM
			// ============================
			if (data.type === "audio-preload-status") {
				if (!game.user.isGM) return;

				const app = AudioPreloadTrackerApp.getInstance();
				app.ensureUsersFromGame();

				if (!app.runId || data.runId !== app.runId) return;

				if (!app.rendered) await app.render(true);

				if (data.status === "started") app.markStarted(data.userId);
				if (data.status === "done") app.markDone(data.userId);

				await app.render(false);
				return;
			}

			// ============================
			// SCENE STATUS: clients -> GM
			// ============================
			if (data.type === "preload-status") {
				if (!game.user.isGM) return;

				const app = PreloadTrackerApp.getInstance();
				app.ensureUsersFromGame();

				const scene = game.scenes.get(data.sceneId);
				if (scene) app.setScene(scene);

				if (!app.rendered) await app.render(true);

				if (data.status === "started") app.markStarted(data.userId);
				if (data.status === "done") app.markDone(data.userId);
				if (data.status === "progress" && typeof data.pct === "number") {
					app.setProgress(data.userId, data.pct);
				}

				await app.render(false);
				return;
			}

		} catch (e) {
			DL(3, "socket handler error", e);
		}
	});

	DL(`registerSocketHandlers(): listening on ${channel}`);
}

// Install libWrapper wrappers around preload entrypoints
function installPreloadWrappers_libWrapper() {
	if (!game.modules.get("lib-wrapper")?.active) {
		DL(3, "installPreloadWrappers_libWrapper(): libWrapper is REQUIRED but not active.");
		return false;
	}

	const register = (...args) => {
		try { libWrapper.register(MOD_ID, ...args); }
		catch (e) { DL(3, "libWrapper.register(): failed", e); }
	};

	let registered = 0;

	// Probe what exists so we don't register missing targets
	const hasSceneProto = typeof Scene?.prototype?.preload === "function";
	const hasCollection = typeof game?.scenes?.preload === "function";

	// Debug probes
	DL(`libWrapper probes: Scene.prototype.preload => ${hasSceneProto ? "function" : typeof Scene?.prototype?.preload}`);
	DL(`libWrapper probes: game.scenes.preload => ${hasCollection ? "function" : typeof game?.scenes?.preload}`);

	// Wrap Scene.prototype.preload (only if it exists)
	if (hasSceneProto) {
		register("Scene.prototype.preload", async function (wrapped, ...args) {
			try {
				DL(`lw[Scene#preload]: started for "${this.name}" (${this.id})`);
				PT_CURRENT_RUN.active = true;
				PT_CURRENT_RUN.sceneId = this.id;

				_ptInstallConsoleProgressTap();
				emitStatus({ type: "preload-status", sceneId: this.id, userId: game.user.id, status: "started" });

				if (game.user.isGM) {
					const app = PreloadTrackerApp.getInstance();
					app.ensureUsersFromGame();
					app.startRun(this);
					if (!app.rendered) await app.render(true);
					app.markStarted(game.user.id);
					await app.render(false);
				}

				const result = await wrapped(...args);

				DL(`lw[Scene#preload]: done for "${this.name}" (${this.id})`);
				emitStatus({ type: "preload-status", sceneId: this.id, userId: game.user.id, status: "done" });

				if (game.user.isGM) {
					const app = PreloadTrackerApp.getInstance();
					app.markDone(game.user.id);
					await app.render(false);
				}

				PT_CURRENT_RUN.active = false;
				_ptRemoveConsoleProgressTap();
				return result;

			} catch (e) {
				DL(3, "lw[Scene#preload]: error", e);
				throw e;
			}
		}, "WRAPPER");
		registered++;
	}

	// Wrap collection call: game.scenes.preload
	if (hasCollection) {
		register("game.scenes.preload", async function (wrapped, id, ...args) {
			try {
				const sc = this.get(id);
				const sceneId = sc?.id ?? id;
				const name = sc?.name ?? String(id);

				DL(`lw[game.scenes.preload]: started for "${name}" (${sceneId})`);
				PT_CURRENT_RUN.active = true;
				PT_CURRENT_RUN.sceneId = sceneId;

				_ptInstallConsoleProgressTap();
				emitStatus({ type: "preload-status", sceneId, userId: game.user.id, status: "started" });

				if (game.user.isGM) {
					const app = PreloadTrackerApp.getInstance();
					app.ensureUsersFromGame();
					app.startRun(sc);
					if (!app.rendered) await app.render(true);
					app.markStarted(game.user.id);
					await app.render(false);
				}

				const result = await wrapped(id, ...args);

				DL(`lw[game.scenes.preload]: done for "${name}" (${sceneId})`);
				emitStatus({ type: "preload-status", sceneId, userId: game.user.id, status: "done" });

				if (game.user.isGM) {
					const app = PreloadTrackerApp.getInstance();
					app.markDone(game.user.id);
					await app.render(false);
				}

				PT_CURRENT_RUN.active = false;
				_ptRemoveConsoleProgressTap();
				return result;

			} catch (e) {
				DL(3, "lw[game.scenes.preload]: error", e);
				throw e;
			}
		}, "WRAPPER");
		registered++;
	}

	if (!registered) {
		DL(3, "installPreloadWrappers_libWrapper(): no valid targets found to wrap. Aborting.");
		return false;
	}

	DL(`installPreloadWrappers_libWrapper(): registered ${registered} wrapper(s) via libWrapper`);
	return true;
}

// Wrap audio preload entrypoints so clients can report status back to the GM window
function installAudioPreloadWrappers_libWrapper() {
	try {
		// Guard: don't install twice
		if (globalThis.__PT_AUDIO_WRAPPERS_INSTALLED) {
			DL("installAudioPreloadWrappers_libWrapper(): already installed");
			return true;
		}
		globalThis.__PT_AUDIO_WRAPPERS_INSTALLED = true;

		if (!game.modules.get("lib-wrapper")?.active) {
			DL(3, "installAudioPreloadWrappers_libWrapper(): libWrapper is REQUIRED but not active.");
			return false;
		}

		const hasPreloadSound = typeof foundry?.audio?.AudioHelper?.preloadSound === "function";
		DL(`audio probe: foundry.audio.AudioHelper.preloadSound => ${hasPreloadSound ? "function" : typeof foundry?.audio?.AudioHelper?.preloadSound}`);

		if (!hasPreloadSound) return false;

		const _labelFromSrc = (src) => {
			try {
				const file = String(src).split("/").pop() ?? String(src);
				return decodeURIComponent(file);
			} catch {
				return String(src);
			}
		};

		const _findPlaylistSoundBySrc = (src) => {
			try {
				if (!src) return null;

				const normalize = (s) => {
					try { return decodeURIComponent(String(s ?? "")).trim().toLowerCase(); }
					catch { return String(s ?? "").trim().toLowerCase(); }
				};

				const target = normalize(src);
				if (!target) return null;

				for (const playlist of (game.playlists?.contents ?? [])) {
					for (const sound of (playlist.sounds?.contents ?? [])) {
						const candidate =
							sound.path ??
							sound.src ??
							sound._source?.path ??
							sound._source?.src ??
							"";

						if (!candidate) continue;
						if (normalize(candidate) === target) return { playlist, sound };
					}
				}
			} catch (e) {
				DL(2, "_findPlaylistSoundBySrc(): failed", e);
			}
			return null;
		};

		const _emitIfTracked = (src, status) => {
			const tracked = PT_AUDIO_TRACKED_SRCS.get(src);
			if (!tracked?.runId) return false;

			emitStatus({
				type: "audio-preload-status",
				runId: tracked.runId,
				src,
				label: tracked.label,
				userId: game.user.id,
				status
			});

			if (status === "done") PT_AUDIO_TRACKED_SRCS.delete(src);
			return true;
		};

		libWrapper.register(
			MOD_ID,
			"foundry.audio.AudioHelper.preloadSound",
			async function (wrapped, src, ...args) {
				try {
					// Always allow the underlying preload to happen
					if (!src) return await wrapped(src, ...args);

					// Debounce repeated calls on startup or spam-clicking
					const now = Date.now();
					if (PT_AUDIO_LAST_START?.src === src && (now - (PT_AUDIO_LAST_START?.ts ?? 0)) < 500) {
						return await wrapped(src, ...args);
					}
					PT_AUDIO_LAST_START = { src, ts: now };

					// GM: only start tracking if this src belongs to a PlaylistSound
					if (game.user.isGM && !PT_AUDIO_TRACKED_SRCS.has(src)) {
						const hit = _findPlaylistSoundBySrc(src);
						if (!hit?.playlist || !hit?.sound) {
							// Not a playlist sound -> do not open tracker window, do not broadcast
							DL(`lw[AudioHelper.preloadSound]: ignoring non-playlist src=${src}`);
							return await wrapped(src, ...args);
						}

						const runId = foundry.utils.randomID();
						const label = `${hit.playlist.name} | ${hit.sound.name || _labelFromSrc(src)}`;

						PT_AUDIO_CURRENT_RUN = { active: true, runId, src, label };
						PT_AUDIO_TRACKED_SRCS.set(src, { runId, label });

						DL(`lw[AudioHelper.preloadSound]: start runId=${runId} src=${src}`);

						// Open GM tracker window
						const app = AudioPreloadTrackerApp.getInstance();
						app.ensureUsersFromGame();
						app.startRun({ runId, src, label });
						if (!app.rendered) await app.render(true);

						// Broadcast to clients so they can attribute started/done to this run
						emitStatus({
							type: "audio-preload-start",
							runId,
							src,
							label,
							userId: game.user.id,
							status: "started"
						});
					}

					// Any client: if tracked, report started/done
					_emitIfTracked(src, "started");
					const result = await wrapped(src, ...args);
					_emitIfTracked(src, "done");

					// GM: mark self done in UI (GM doesn't receive their own socket emit)
					if (game.user.isGM) {
						const app = AudioPreloadTrackerApp.getInstance();
						if (app.rendered && app.src === src) {
							app.markDone(game.user.id);
							await app.render(false);
						}
					}

					return result;

				} catch (e) {
					DL(3, "lw[AudioHelper.preloadSound]: error", { src, e });
					throw e;
				}
			},
			"MIXED"
		);

		DL("installAudioPreloadWrappers_libWrapper(): wrapped foundry.audio.AudioHelper.preloadSound");
		return true;

	} catch (e) {
		DL(3, "installAudioPreloadWrappers_libWrapper(): failed", e);
		return false;
	}
}

/* =====================================================================================
	HOOKS REGISTRATION
===================================================================================== */
Hooks.once("ready", () => {
	
	try {

		// Ensure Libwrapper is available
		if (!game.modules.get("lib-wrapper")?.active) {
			DL(3, "ready(): libWrapper is REQUIRED. Enable the 'libWrapper' module and reload.");
			ui.notifications?.error(LT.libwrapperReq());
			return; // hard stop; no wrappers installed
		}

		registerSocketHandlers();

		const okScene = installPreloadWrappers_libWrapper();
		if (!okScene) {
			ui.notifications?.warn("Preload Tracker: no scene preload entrypoint found to wrap on this build.");
		} else {
			DL("ready(): scene preload wrappers installed");
		}

		const okAudio = installAudioPreloadWrappers_libWrapper();
		if (!okAudio) {
			ui.notifications?.warn("Preload Tracker: audio preload wrapper could not be installed.");
		} else {
			DL("ready(): audio preload wrapper installed");
		}

		DL("ready(): socket + wrappers installed");

	} catch (e) {
		DL(3, "ready(): failed to initialize", e);
	}
});

Hooks.once("init", () => {

	//Register debul level setting
	game.settings.register(MOD_ID, "debugLevel", {
			name: game.i18n.localize("preload-tracker.settings.debugLevelName"),
			hint: game.i18n.localize("preload-tracker.settings.debugLevelHint"),
			scope: "world",
			config: true,
			type: String,
			choices: {
				"none": game.i18n.localize("preload-tracker.settings.debugLevelNone"),
				"error": game.i18n.localize("preload-tracker.settings.debugLevelError"),
				"warn": game.i18n.localize("preload-tracker.settings.debugLevelWarn"),
				"all": game.i18n.localize("preload-tracker.settings.debugLevelAll")
			},
			default: "none", // Default to no logging
			requiresReload: false
		});
	console.log(`%cPreload Tracker | init hook fired`, "color: #7e56db; font-weight: bold;");
});
