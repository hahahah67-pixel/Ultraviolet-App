"use strict";

/**
 * Registers both service workers:
 *   - /uv/uv.sw.js  → handles Ultraviolet requests under /uv/service/*
 *   - /sw.js        → handles Scramjet requests via scramjet.route()
 *
 * Both run side by side without conflict because they intercept
 * different URL prefixes.
 *
 * UV registration is non-fatal: if it fails (e.g. missing file), we warn
 * and continue so Scramjet still works.
 */

const uvSW = "/uv/uv.sw.js";
const sjSW = "/sw.js";

const swAllowedHostnames = ["localhost", "127.0.0.1"];

async function registerSW() {
	if (!navigator.serviceWorker) {
		if (
			location.protocol !== "https:" &&
			!swAllowedHostnames.includes(location.hostname)
		)
			throw new Error("Service workers cannot be registered without https.");

		throw new Error("Your browser doesn't support service workers.");
	}

	// Register Ultraviolet's service worker — non-fatal so SJ still works if UV fails
	try {
		await navigator.serviceWorker.register(uvSW);
	} catch (e) {
		console.warn("[Fish] UV service worker registration failed (UV proxy unavailable):", e);
	}

	// Register Scramjet's service worker — required for SJ proxy
	await navigator.serviceWorker.register(sjSW);
}
