export const MOD_ID = "preload-tracker";

/*
    Simple debuig logger to style console messages
    DL("msg") => info
    DL(2, "msg") => warn
    DL(3, "msg") => error
*/
export function DL(intLogType, stringLogMsg, objObject = null) {
	// Allow DL("string") shorthand
	if (typeof intLogType === "string") {
		objObject = stringLogMsg;
		stringLogMsg = intLogType;
		intLogType = 1;
	}
	const now = new Date();
	const ts = now.toTimeString().split(" ")[0];

	const level = intLogType ?? 1;
	const pref = `Preset Tracker [${ts}] |`;

	if (objObject) {
		if (level === 3) console.error(`${pref} ERROR: ${stringLogMsg}`, objObject);
		else if (level === 2) console.warn(`${pref} WARNING: ${stringLogMsg}`, objObject);
		else console.log(`${pref} ${stringLogMsg}`, objObject);
	} else {
		if (level === 3) console.error(`${pref} ERROR: ${stringLogMsg}`);
		else if (level === 2) console.warn(`${pref} WARNING: ${stringLogMsg}`);
		else console.log(`${pref} ${stringLogMsg}`);
	}
}

Hooks.once("init", () => {
	DL("init(): preload-tracker ready");
});
