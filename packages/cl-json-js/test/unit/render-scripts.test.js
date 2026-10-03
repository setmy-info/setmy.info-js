import test from "node:test";
import assert from "node:assert/strict";

import { SCRIPT_TYPE, renderScripts } from "../../src/index.js";
import { FakeDocument, html } from "./fake-dom.js";

function script(document, type, text, attributes = {}) {
    const element = document.createElement("script");
    element.setAttribute("type", type);
    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }
    element.appendChild(document.createTextNode(text));
    document.body.appendChild(element);
    return element;
}

test("renderScripts mounts every payload script of a page", () => {
    const document = new FakeDocument();
    const app = document.createElement("div");
    app.setAttribute("id", "app");
    document.body.appendChild(app);
    script(document, "application/json", '{"user": {"name": "Ann"}}', {
        id: "app-state",
    });
    script(
        document,
        SCRIPT_TYPE,
        '[":h1", ["cl:format", null, "Hello ~a", ["cl:getf", "user.name"]]]',
        { "data-target": "#app", "data-state": "app-state" },
    );
    const inline = script(document, SCRIPT_TYPE, '[":p", "next to me"]');

    const views = renderScripts(document);

    assert.equal(views.length, 2);
    assert.equal(html(app), '<div id="app"><h1>Hello Ann</h1></div>');
    assert.deepEqual(views[0].state, { user: { name: "Ann" } });
    assert.equal(html(inline.nextSibling), "<div><p>next to me</p></div>");
});
