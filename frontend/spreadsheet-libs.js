(function exposeSpreadsheetLibraries(global) {
    const pendingLoads = new Map();

    function loadLibrary(key, source, isReady) {
        if (isReady()) return Promise.resolve();
        if (pendingLoads.has(key)) return pendingLoads.get(key);

        const pending = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = source;
            script.async = true;
            script.dataset.spreadsheetLibrary = key;
            script.addEventListener("load", () => {
                if (isReady()) resolve();
                else reject(new Error(`${key} loaded without exposing its browser API`));
            }, { once: true });
            script.addEventListener("error", () => {
                reject(new Error(`${key} could not be downloaded`));
            }, { once: true });
            document.head.appendChild(script);
        }).catch(error => {
            pendingLoads.delete(key);
            throw error;
        });

        pendingLoads.set(key, pending);
        return pending;
    }

    global.SpreadsheetLibraries = Object.freeze({
        ensureXlsx() {
            return loadLibrary("xlsx", "/vendor/xlsx.full.min.js", () => typeof global.XLSX !== "undefined");
        },
        ensureExcelJs() {
            return loadLibrary("exceljs", "/vendor/exceljs.min.js", () => typeof global.ExcelJS !== "undefined");
        }
    });
})(window);
