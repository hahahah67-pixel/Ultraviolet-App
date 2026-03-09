"use strict";

window.addEventListener("load", () => {
    const form = document.getElementById("uv-form");
    const address = document.getElementById("uv-address");
    const searchEngine = document.getElementById("uv-search-engine");
    const error = document.getElementById("uv-error");
    const errorCode = document.getElementById("uv-error-code");
    const homeUI = document.getElementById("home-ui");
    const frame = document.getElementById("uv-frame");

    // Proxy engine setting
    let proxyEngine = localStorage.getItem("proxyEngine") || "uv";

    const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

    // Helper to validate or convert user input to a full URL
    function search(input, engine) {
        input = input.trim();
        if (!input) return "";

        // If it's already a full URL
        if (/^https?:\/\//i.test(input)) return input;

        // If it looks like domain-only (example.com), add https
        if (/^[\w\-]+\.[\w\-]+/.test(input)) return "https://" + input;

        // Otherwise treat as a search query
        return engine.replace("%s", encodeURIComponent(input));
    }

    async function loadSite(url) {
        if (!url) {
            error.textContent = "Please enter a valid URL or search term.";
            return;
        }

        try {
            await registerSW();
        } catch (err) {
            error.textContent = "Failed to register service worker.";
            errorCode.textContent = err.toString();
            return;
        }

        // Hide homepage and show iframe
        homeUI.style.display = "none";
        frame.style.display = "block";

        const wispUrl =
            (location.protocol === "https:" ? "wss" : "ws") +
            "://" +
            location.host +
            "/wisp/";

        try {
            if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
                await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
            }
        } catch (err) {
            error.textContent = "Failed to setup connection.";
            errorCode.textContent = err.toString();
            return;
        }

        // Launch correct proxy engine
        if (proxyEngine === "uv") {
            frame.src = __uv$config.prefix + __uv$config.encodeUrl(url);
        } else if (proxyEngine === "sj") {
            frame.src = "/scramjet/" + encodeURIComponent(url);
        }
    }

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        error.textContent = "";
        errorCode.textContent = "";
        const url = search(address.value, searchEngine.value);
        loadSite(url);
    });

    // Fallback: if iframe fails or blank, show homepage
    frame.addEventListener("error", () => {
        homeUI.style.display = "flex";
        frame.style.display = "none";
        error.textContent = "Failed to load the site.";
    });

    frame.addEventListener("load", () => {
        if (!frame.src || frame.src === "about:blank") {
            homeUI.style.display = "flex";
            frame.style.display = "none";
        }
    });
});
