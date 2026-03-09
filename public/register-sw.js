"use strict";

const stockSW = "/sw.js";

const swAllowedHostnames = ["localhost", "127.0.0.1"];

async function registerSW() {

	if (!navigator.serviceWorker) {
		console.warn("Service workers not supported.");
		return;
	}

	if (
		location.protocol !== "https:" &&
		!swAllowedHostnames.includes(location.hostname)
	) {
		console.warn("Service workers require HTTPS.");
		return;
	}

	try {
		await navigator.serviceWorker.register(stockSW);
		console.log("Service worker registered.");
	} catch (err) {
		console.error("Service worker registration failed:", err);
	}
}
