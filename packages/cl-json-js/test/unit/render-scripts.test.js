import test from "node:test";
import assert from "node:assert/strict";

import { SCRIPT_TYPE, mount, renderScripts } from "../../src/index.js";
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

test("renderScripts mounts every inline payload script of a page", async () => {
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

    const pending = renderScripts(document);
    assert.equal(
        html(app),
        '<div id="app"><h1>Hello Ann</h1></div>',
        "inline: mounted at once",
    );
    const views = await pending;

    assert.equal(views.length, 2);
    assert.equal(html(app), '<div id="app"><h1>Hello Ann</h1></div>');
    assert.deepEqual(views[0].state, { user: { name: "Ann" } });
    assert.equal(html(inline.nextSibling), "<div><p>next to me</p></div>");
});

test("renderScripts fetches src and data-state-src files", async () => {
    const document = new FakeDocument();
    const files = {
        "w/tips.cl.json": [
            ":p",
            ["cl:nth", ["cl:getf", "i"], ["cl:getf", "tips"]],
        ],
        "w/tips.state.json": { i: 1, tips: ["a", "b"] },
    };
    const requested = [];
    const fetch = async (url) => {
        requested.push(url);
        return url in files
            ? { ok: true, json: async () => files[url] }
            : { ok: false, status: 404 };
    };
    const target = document.createElement("div");
    target.setAttribute("id", "tips");
    document.body.appendChild(target);
    script(document, SCRIPT_TYPE, "", {
        src: "w/tips.cl.json",
        "data-state-src": "w/tips.state.json",
        "data-target": "tips",
    });
    script(document, SCRIPT_TYPE, '[":b", ["cl:getf", "x"]]', {
        "data-state-src": "w/tips.state.json",
    });

    const views = await renderScripts(document, { fetch });

    assert.equal(html(target), '<div id="tips"><p>b</p></div>');
    assert.deepEqual(views[0].state, { i: 1, tips: ["a", "b"] });
    assert.deepEqual(requested.sort(), [
        "w/tips.cl.json",
        "w/tips.state.json",
        "w/tips.state.json",
    ]);

    script(document, SCRIPT_TYPE, "", { src: "w/missing.cl.json" });
    await assert.rejects(
        renderScripts(document, { fetch }),
        /w\/missing.cl.json: HTTP 404/,
    );
});

test("data-target takes an id or a selector; mount takes an element id", async () => {
    const document = new FakeDocument();
    const slot = document.createElement("section");
    slot.setAttribute("id", "slot");
    document.body.appendChild(slot);
    script(document, SCRIPT_TYPE, '[":i", "by id"]', { "data-target": "slot" });
    await renderScripts(document);
    assert.equal(html(slot), '<section id="slot"><i>by id</i></section>');

    mount("slot", [":b", "mounted by id"], {}, { document });
    assert.equal(slot.textContent, "mounted by id");
    mount("#slot", [":b", "with hash"], {}, { document });
    assert.equal(slot.textContent, "with hash");
    assert.throws(
        () => mount("nope", [":b"], {}, { document }),
        /no element with id/,
    );

    script(document, SCRIPT_TYPE, "[]", { "data-target": "nope" });
    assert.throws(
        () => renderScripts(document),
        /data-target nope: no such element/,
    );
});
