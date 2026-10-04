import test from "node:test";
import assert from "node:assert/strict";

import { SCRIPT_TYPE, include, load, renderScripts } from "../../src/index.js";
import { FakeDocument, html } from "./fake-dom.js";

// A fetch over fake files: url -> parsed JSON (or a raw text that is no JSON).
function fakeFetch(files) {
    return async (url) => {
        if (!(url in files)) {
            return { ok: false, status: 404 };
        }
        const body = files[url];
        return {
            ok: true,
            status: 200,
            json: async () =>
                typeof body === "string" ? JSON.parse(body) : body,
        };
    };
}

const refused = async () => {
    throw new TypeError("NetworkError when attempting to fetch resource.");
};

function withFileLocation(run) {
    globalThis.location = { protocol: "file:" };
    return Promise.resolve()
        .then(run)
        .finally(() => {
            delete globalThis.location;
        });
}

test("load() reads a JSON resource", async () => {
    const fetch = fakeFetch({ "pages/a.json": [":p", "hi"] });
    assert.deepEqual(await load("pages/a.json", { fetch }), [":p", "hi"]);
});

test("load() accepts a file:// response (status 0)", async () => {
    const fetch = async () => ({ ok: false, status: 0, json: async () => 1 });
    assert.equal(await load("a.json", { fetch }), 1);
});

test("load() reports HTTP errors, broken JSON and refused reads", async () => {
    const fetch = fakeFetch({ "bad.json": "{nope" });
    await assert.rejects(load("none.json", { fetch }), /none\.json: HTTP 404/);
    await assert.rejects(load("bad.json", { fetch }), /bad\.json: not JSON/);
    await assert.rejects(load("c.json", { fetch: refused }), (error) => {
        assert.match(error.message, /^c\.json: NetworkError/);
        assert.doesNotMatch(error.message, /file:\/\//);
        return true;
    });
    // Opened from disk, the reason and the way out are spelled out.
    await withFileLocation(() =>
        assert.rejects(
            load("c.json", { fetch: refused }),
            /opened from file:\/\/ read files: serve it over HTTP .*strict_origin_policy = false/,
        ),
    );
});

test("include() renders a resource into an element or an element id", async () => {
    const document = new FakeDocument();
    const target = document.createElement("div");
    target.setAttribute("id", "cart");
    document.body.appendChild(target);
    const fetch = fakeFetch({
        "pages/cart.json": [":p", "Total ", ["cl:getf", "total"]],
    });

    const view = await include(
        "cart",
        "pages/cart.json",
        { total: 3 },
        {
            document,
            fetch,
        },
    );
    assert.equal(html(target), '<div id="cart"><p>Total 3</p></div>');
    view.update({ total: 4 });
    assert.equal(target.textContent, "Total 4");

    await include(target, "pages/cart.json", { total: 5 }, { document, fetch });
    assert.equal(target.textContent, "Total 5");
});

test("include() writes a failure into its target and rejects", async () => {
    const document = new FakeDocument();
    const target = document.createElement("div");
    target.appendChild(document.createTextNode("old"));
    const fetch = fakeFetch({ "broken.json": ["cl:nope"] });

    await assert.rejects(
        include(target, "missing.json", {}, { document, fetch }),
        /missing\.json: HTTP 404/,
    );
    assert.equal(target.textContent, "missing.json: HTTP 404");
    assert.equal(target.getAttribute("data-cl-json-error"), "");

    await assert.rejects(
        include(target, "broken.json", {}, { document, fetch }),
        /Undefined operator: cl:nope/,
    );
    assert.equal(target.textContent, "Undefined operator: cl:nope");

    await assert.rejects(
        include("nowhere", "a.json", {}, { document, fetch }),
        /no element nowhere/,
    );
});

test("<script type=application/cl+json src=...json> includes the resource", async () => {
    const document = new FakeDocument();
    const target = document.createElement("div");
    target.setAttribute("id", "home");
    document.body.appendChild(target);
    const tag = document.createElement("script");
    tag.setAttribute("type", SCRIPT_TYPE);
    tag.setAttribute("src", "pages/home.json");
    tag.setAttribute("data-target", "home");
    document.body.appendChild(tag);

    await renderScripts(document, {
        fetch: fakeFetch({ "pages/home.json": [":h1", "from a file"] }),
    });
    assert.equal(html(target), '<div id="home"><h1>from a file</h1></div>');
});
