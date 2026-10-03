// A minimal DOM for the unit tier: exactly the surface the interpreter uses
// (createElement[NS], createTextNode, createDocumentFragment, attributes,
// appendChild/removeChild, events), plus html() to serialize for assertions.
// No jsdom dependency.

class FakeNode {
    constructor(nodeType, ownerDocument) {
        this.nodeType = nodeType;
        this.ownerDocument = ownerDocument;
        this.childNodes = [];
        this.parentNode = null;
    }

    get firstChild() {
        return this.childNodes[0] ?? null;
    }

    appendChild(node) {
        if (node.nodeType === 11) {
            for (const childNode of [...node.childNodes]) {
                this.appendChild(childNode);
            }
            return node;
        }
        node.parentNode?.removeChild(node);
        node.parentNode = this;
        this.childNodes.push(node);
        return node;
    }

    insertBefore(node, reference) {
        node.parentNode?.removeChild(node);
        node.parentNode = this;
        const index = reference ? this.childNodes.indexOf(reference) : -1;
        if (index < 0) {
            this.childNodes.push(node);
        } else {
            this.childNodes.splice(index, 0, node);
        }
        return node;
    }

    get nextSibling() {
        const siblings = this.parentNode?.childNodes ?? [];
        return siblings[siblings.indexOf(this) + 1] ?? null;
    }

    removeChild(node) {
        this.childNodes.splice(this.childNodes.indexOf(node), 1);
        node.parentNode = null;
        return node;
    }

    contains(node) {
        for (let n = node; n; n = n.parentNode) {
            if (n === this) {
                return true;
            }
        }
        return false;
    }

    get textContent() {
        return this.childNodes.map((node) => node.textContent).join("");
    }

    *descendants() {
        for (const node of this.childNodes) {
            yield node;
            if (node.descendants) {
                yield* node.descendants();
            }
        }
    }
}

class FakeText extends FakeNode {
    constructor(text, ownerDocument) {
        super(3, ownerDocument);
        this.data = text;
    }

    get textContent() {
        return this.data;
    }
}

class FakeElement extends FakeNode {
    constructor(tagName, namespaceURI, ownerDocument) {
        super(1, ownerDocument);
        this.tagName = tagName;
        this.namespaceURI = namespaceURI;
        this.attributes = new Map();
        this.attributeNamespaces = new Map();
        this.listeners = {};
    }

    get id() {
        return this.attributes.get("id") ?? "";
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    setAttributeNS(namespace, name, value) {
        this.attributeNamespaces.set(name, namespace);
        this.setAttribute(name, value);
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    addEventListener(type, listener) {
        (this.listeners[type] ??= []).push(listener);
    }

    dispatch(type, event = {}) {
        for (const listener of this.listeners[type] ?? []) {
            listener({ type, target: this, ...event });
        }
    }

    focus() {
        this.ownerDocument.activeElement = this;
    }

    setSelectionRange(start, end) {
        this.selection = [start, end];
    }

    // Selectors this test suite needs: #id, tag, tag[attr="value"].
    matches(selector) {
        if (selector.startsWith("#")) {
            return this.id === selector.slice(1);
        }
        const match = /^([\w-]+)(?:\[([\w-]+)="([^"]*)"\])?$/.exec(selector);
        return (
            match !== null &&
            this.tagName === match[1] &&
            (!match[2] || this.getAttribute(match[2]) === match[3])
        );
    }

    querySelectorAll(selector) {
        return [...this.descendants()].filter(
            (node) => node.nodeType === 1 && node.matches(selector),
        );
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] ?? null;
    }
}

export class FakeDocument extends FakeNode {
    constructor() {
        super(9, null);
        this.activeElement = null;
        this.body = this.createElement("body");
        this.appendChild(this.body);
    }

    createElement(tagName) {
        return new FakeElement(tagName, "http://www.w3.org/1999/xhtml", this);
    }

    createElementNS(namespaceURI, tagName) {
        return new FakeElement(tagName, namespaceURI, this);
    }

    createTextNode(text) {
        return new FakeText(text, this);
    }

    createDocumentFragment() {
        return new FakeNode(11, this);
    }

    getElementById(id) {
        return this.querySelector(`#${id}`);
    }

    querySelectorAll(selector) {
        return this.body.querySelectorAll(selector);
    }

    querySelector(selector) {
        return this.body.querySelector(selector);
    }
}

function escape(text) {
    return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Serializes a fake node to HTML.
 * @param {object} node A fake node.
 * @returns {string} The markup.
 */
export function html(node) {
    if (node.nodeType === 3) {
        return escape(node.data);
    }
    const inner = node.childNodes.map(html).join("");
    if (node.nodeType !== 1) {
        return inner;
    }
    const attributes = [...node.attributes]
        .map(([name, value]) => ` ${name}="${escape(value)}"`)
        .join("");
    return `<${node.tagName}${attributes}>${inner}</${node.tagName}>`;
}
