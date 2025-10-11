/* =======================================================================
		Dynamic Localization helper 
		- A simple localization helper
    	- Works with any preload-tracker.* key path found in en.json
======================================================================= */

import { DL } from "./tracker.js";

// Start all lookups from the root of MOD_ID
export const LT = makeNode("preload-tracker");

/* 	L: localize a key (no placeholders) */
export function L(key) {
	try {
		if (typeof key !== "string") { DL(2, "L(): key must be string", { key }); return String(key); }
		const s = game.i18n.localize(key);
		if (s === key) DL(2, "L(): missing key", { key });
		return s;
	} catch (err) {
		DL(3, "L(): error", err);
		return key;
	}
}

/* 	LF: format a key with {placeholders} */
export function LF(key, data = {}) {
	try {
		const out = game.i18n.format(key, data);
		if (out === key) DL(2, "LF(): missing key", { key, data });
		return out;
	} catch (err) {
		DL(3, "LF(): error", err);
		return key;
	}
}

/* 	Dynamic LT:
	- Any property chain becomes a key path under "preload-tracker"
	- Call with no args => L()
	- Call with an object => LF()
*/
function makeNode(key) {
	// Callable function: LT.something(...) -> localize/format
	const fn = (data) => {
		return data && typeof data === "object" ? LF(key, data) : L(key);
	};
	// Proxy to catch property access and build nested keys
	return new Proxy(fn, {
		get(_target, prop) {
			// Avoid prototype noise
			if (prop === "prototype" || prop === "name" || prop === "length") return undefined;
			// Allow peeking at full key if ever needed
			if (prop === "_key") return key;
			// Build nested path
			const nextKey = key ? key + "." + String(prop) : String(prop);
			return makeNode(nextKey);
		}
	});
}