// The page a spec file tests, from its own file name - setmy-info-less's
// testPageName.cjs: cart.e2e.js and cart.gherkin.e2e.js both test "cart".
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @param {string} fileUrl The spec's import.meta.url.
 * @returns {string} The file name up to its first dot.
 */
export function testPageName(fileUrl) {
    return path.basename(fileURLToPath(fileUrl)).split(".")[0];
}
