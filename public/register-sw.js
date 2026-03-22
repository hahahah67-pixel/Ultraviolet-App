"use strict";

/**
 * Registers both service workers:
 *   - /uv/sw.js  → handles Ultraviolet requests under /uv/service/*
 *   - /sw.js     → handles Scramjet requests via scramjet.route()
 *
 * Both run side by side without conflict because they intercept
 * different URL prefixes.
 */

const uvSW = "/uv/sw.js";
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

	// Register Ultraviolet's service worker
	await navigator.serviceWorker.register(uvSW);

	// Register Scramjet's service worker
	await navigator.serviceWorker.register(sjSW);
}
