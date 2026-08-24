(() => {
    const iconRoot = "/assets/heroicons/";

    const iconForText = (element) => {
        const explicit = element.dataset.uiIcon;
        if (explicit) return explicit;

        const text = element.textContent.replace(/\s+/g, " ").trim().toLowerCase();
        const className = String(element.className || "").toLowerCase();

        if (text.includes("change password") || text.includes("reset password")) return "key";
        if (text === "logout" || text.includes("log out")) return "arrow-right-start-on-rectangle";
        if (text.startsWith("back")) return "arrow-left";
        if (text.includes("transfer")) return "arrows-right-left";
        if (text.includes("attendance history")) return "clock";
        if (text.includes("take attendance") || text.includes("save attendance")) return "clipboard-document-check";
        if (text.includes("mark leave") || text.includes("save leave")) return "calendar-days";
        if (text.includes("marks") || text.includes("results")) return "chart-bar";
        if (text.includes("import") || text.includes("upload")) return "arrow-up-tray";
        if (text.includes("excel") || className.includes("excel")) return null;
        if (text.includes("download") || text.includes("export")) return "document-arrow-down";
        if (text.includes("restore")) return "arrow-path";
        if (text.includes("publish")) return "eye";
        if (text.includes("settings")) return "cog-6-tooth";
        if (text.includes("edit")) return "pencil-square";
        if (text.includes("delete") || text.includes("remove")) return "trash";
        if (text.includes("add teacher") || text.includes("add administrator") || text.includes("add admin") || text.includes("create administrator")) return "user-plus";
        if (text.includes("teachers") || text.includes("administrators") || text.includes("accounts")) return "users";
        if (text.includes("add class") || text.includes("create class") || text.includes("add roll")) return "plus";
        if (text.includes("open class")) return "book-open";
        if (text === "cancel" || text.startsWith("cancel ")) return "x-mark";
        if (text.startsWith("save") || text.startsWith("confirm")) return "check";
        return null;
    };

    const decorate = (root = document) => {
        const selector = "button, a.primary-btn, a.secondary-btn, a.back-btn, a.back-link";
        const elements = root.matches?.(selector) ? [root] : root.querySelectorAll?.(selector) || [];

        elements.forEach((element) => {
            if (element.dataset.heroiconApplied === "true" && !element.querySelector(":scope > .ui-heroicon")) {
                delete element.dataset.heroiconApplied;
            }
            if (element.dataset.heroiconApplied === "true") return;
            const icon = iconForText(element);
            if (!icon) return;

            const image = document.createElement("span");
            image.className = "ui-heroicon";
            image.style.setProperty("--ui-icon-url", `url("${iconRoot}${icon}.svg")`);
            image.setAttribute("aria-hidden", "true");
            if (icon === "table-cells") image.classList.add("excel-icon");
            element.insertBefore(image, element.firstChild);
            element.dataset.heroiconApplied = "true";
            element.classList.add("has-ui-icon");
        });
    };

    const headingSelector = [
        ".section-title h2", ".section-header h2", ".panel-heading h2",
        ".password-panel-heading h2", ".welcome h1", ".course-header h1",
        ".hero-copy h1", ".hero-panel > h1", ".login-card h1",
        ".panel > h1", ".panel > h2", ".course-card h3", ".form-header h2",
        ".settings-group h3", ".attendance-editor-header h3", ".audit-panel h3",
        ".result-heading h2"
    ].join(",");

    const revealHeadings = (root = document, restart = false) => {
        const headings = root.matches?.(headingSelector) ? [root] : root.querySelectorAll?.(headingSelector) || [];
        headings.forEach((heading) => {
            if (restart) {
                heading.classList.remove("gold-line-reveal");
                void heading.offsetWidth;
            }
            heading.classList.add("gold-line-reveal");
        });
    };

    const syncLoadingButton = (button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const label = button.textContent.replace(/\s+/g, " ").trim();
        const loading = /^(saving|preparing|uploading|importing|updating|creating|transferring)/i.test(label);
        button.classList.toggle("is-loading", loading);
    };

    const refreshElement = (node) => {
        const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        if (!element) return;
        decorate(element);
        if (element.matches?.("button")) syncLoadingButton(element);
        element.querySelectorAll?.("button").forEach(syncLoadingButton);
    };

    const start = () => {
        decorate(document);
        revealHeadings(document);
        document.querySelectorAll("button").forEach(syncLoadingButton);
        new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                refreshElement(mutation.target);
                mutation.addedNodes.forEach((node) => {
                    refreshElement(node);
                    if (node.nodeType === Node.ELEMENT_NODE) revealHeadings(node);
                });
                if (
                    mutation.type === "attributes" &&
                    mutation.attributeName === "class" &&
                    String(mutation.oldValue || "").split(/\s+/).includes("hidden") &&
                    mutation.target instanceof HTMLElement &&
                    !mutation.target.classList.contains("hidden")
                ) {
                    revealHeadings(mutation.target, true);
                }
            });
        }).observe(document.body, {
            childList: true,
            characterData: true,
            attributes: true,
            attributeOldValue: true,
            attributeFilter: ["class", "disabled"],
            subtree: true
        });
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();

