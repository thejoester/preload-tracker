import { MOD_ID, DL } from "./settings.js";
import { LT } from "./localization.js";

/* =====================================================================================
	TRACKER UI (ApplicationV2)
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
			this.users.set(uid, rec);
		}
	}

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

	markStarted(userId) {
		const rec = this.users.get(userId);
		if (rec) { rec.started = true; this.users.set(userId, rec); }
	}

	markDone(userId) {
		const rec = this.users.get(userId);
		if (rec) { rec.started = true; rec.done = true; this.users.set(userId, rec); }
	}

	/* ===== ApplicationV2 required methods ===== */

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
				status.innerHTML = `<i class="fas fa-spinner pt-spin pt-orange" title="${LT.loading()}"></i>`;
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
	SOCKET HANDLERS
===================================================================================== */
function emitStatus(payload) {
	try {
		const channel = `module.${MOD_ID}`;
		DL(`emit: tx ${payload?.status} user=${payload?.userId} scene=${payload?.sceneId} -> ${channel}`);
		game.socket.emit(channel, payload);
	} catch (e) {
		DL(3, "emitStatus(): socket emit failed", e);
	}
}

function registerSocketHandlers() {
	const channel = `module.${MOD_ID}`;
	game.socket.on(channel, async (data) => {
		try {
			if (!data || typeof data !== "object") return;
			if (!game.user.isGM) return;
			if (data.type !== "preload-status") return;

			const app = PreloadTrackerApp.getInstance();
			app.ensureUsersFromGame();

			const scene = game.scenes.get(data.sceneId);
			if (scene) app.setScene(scene);

			if (!app.rendered) await app.render(true);

			if (data.status === "started") app.markStarted(data.userId);
			if (data.status === "done") app.markDone(data.userId);

			await app.render(false);

		} catch (e) {
			DL(3, "socket handler error", e);
		}
	});
	DL(`registerSocketHandlers(): listening on ${channel}`);
}

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

	DL(`libWrapper probes: Scene.prototype.preload => ${hasSceneProto ? "function" : typeof Scene?.prototype?.preload}`);
	DL(`libWrapper probes: game.scenes.preload => ${hasCollection ? "function" : typeof game?.scenes?.preload}`);

	// Wrap Scene.prototype.preload (only if it exists)
	if (hasSceneProto) {
		register("Scene.prototype.preload", async function (wrapped, ...args) {
			try {
				DL(`lw[Scene#preload]: started for "${this.name}" (${this.id})`);
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
				return result;
			} catch (e) {
				DL(3, "lw[Scene#preload]: error", e);
				throw e;
			}
		}, "WRAPPER");
		registered++;
	}

	// Wrap collection call: game.scenes.preload (this is the path we saw in your logs)
	if (hasCollection) {
		register("game.scenes.preload", async function (wrapped, id, ...args) {
			try {
				const sc = this.get(id);
				const sceneId = sc?.id ?? id;
				const name = sc?.name ?? String(id);

				DL(`lw[game.scenes.preload]: started for "${name}" (${sceneId})`);
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
		const ok = installPreloadWrappers_libWrapper();
		if (!ok) {
			ui.notifications?.warn("Preload Tracker: no preload entrypoint found to wrap on this build.");
		} else {
			DL("ready(): libWrapper wrappers installed");
		}
		DL("ready(): socket + wrappers installed");
	} catch (e) {
		DL(3, "ready(): failed to initialize", e);
	}
});