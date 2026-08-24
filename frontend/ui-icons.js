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
        if (text.includes("excel") || className.includes("excel")) return "table-cells";
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

    const start = () => {
        decorate(document);
        new MutationObserver((mutations) => {
            mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) decorate(node);
            }));
        }).observe(document.body, { childList: true, subtree: true });
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();

