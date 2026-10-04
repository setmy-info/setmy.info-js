/*
DTO layer for Gherkin test cases - this is the API (setmy-info-less's
scripts/gherkin/dto.cjs, the same sentences, plus the steps an interactive
page needs: clicking a button, typing, text, count and attribute checks).

Every Gherkin sentence used by the test suites is one step DTO:
    { keyword: 'Given'|'When'|'Then', action: '<step id>', args: [...], text: '<gherkin sentence>' }

The DTOs are pure data: the runner (runner.js) executes them against
scripts/pageHelper.js as node:test e2e tests, and the writer (writer.js)
serializes them back into .feature text, so the same objects can be used as
Gherkin test cases later.
*/

export const SENTENCES = {
    pageNameIs: (name) => `page name is "${name}"`,
    pageIsRendered: () => "page is rendered",
    pageElementIdIs: (elementId) => `page element ID is "${elementId}"`,
    pageElementIs: (selector) => `page element is "${selector}"`,
    pageElementIdIsClicked: (elementId) =>
        `page element ID "${elementId}" is clicked`,
    pageElementIsClicked: (selector) => `page element "${selector}" is clicked`,
    pageButtonIsClicked: (label, scope) =>
        `page button "${label}" in "${scope}" is clicked`,
    pageTextIsTypedInto: (text, selector) =>
        `text "${text}" is typed into "${selector}"`,
    pageEnterIsPressedIn: (selector) => `Enter is pressed in "${selector}"`,
    pageShouldHaveTitle: (title) => `page should have title "${title}"`,
    pageElementTextShouldBe: (selector, text) =>
        `page element "${selector}" text should be "${text}"`,
    pageElementTextShouldContain: (selector, text) =>
        `page element "${selector}" text should contain "${text}"`,
    pageElementCountShouldBe: (selector, count) =>
        `page should have ${count} elements "${selector}"`,
    pageElementAttributeShouldBe: (selector, name, value) =>
        `page element "${selector}" attribute "${name}" should be "${value}"`,
    pageElementMarginShouldBe: (margin) =>
        `page element margin should be "${margin}"`,
    pageElementPaddingShouldBe: (padding) =>
        `page element padding should be "${padding}"`,
    pageElementFontFamilyShouldBe: (fontFamily) =>
        `page element font family should be "${fontFamily}"`,
    pageElementFontSizeShouldBe: (fontSize) =>
        `page element font size should be "${fontSize}"`,
    pageElementFontWeightShouldBe: (fontWeight) =>
        `page element font weight should be "${fontWeight}"`,
    pageElementXShouldBe: (x) => `page element X should be ${x}`,
    pageElementYShouldBe: (y) => `page element Y should be ${y}`,
    pageElementWidthShouldBe: (width) =>
        `page element WIDTH should be ${width}`,
    pageElementHeightShouldBe: (height) =>
        `page element HEIGHT should be ${height}`,
    pageElementTopShouldBe: (top) => `page element TOP should be ${top}`,
    pageElementLeftShouldBe: (left) => `page element LEFT should be ${left}`,
    pageElementBackgroundColorShouldBe: (color) =>
        `page element background color should be "${color}"`,
    pageElementColorShouldBe: (color) =>
        `page element color should be "${color}"`,
    pageElementStyleShouldBe: (propertyName, value) =>
        `page element style "${propertyName}" should be "${value}"`,
    pageIsClosed: () => "page is closed",
};

export function step(keyword, action, ...args) {
    if (!Object.hasOwn(SENTENCES, action)) {
        throw new Error(`Unknown Gherkin step: ${action}`);
    }
    return { keyword, action, args, text: SENTENCES[action](...args) };
}

const stepsOf = (keyword, actions) =>
    Object.fromEntries(
        actions.map((action) => [
            action,
            (...args) => step(keyword, action, ...args),
        ]),
    );

export const given = stepsOf("Given", ["pageNameIs"]);

export const when = stepsOf("When", [
    "pageIsRendered",
    "pageElementIdIs",
    "pageElementIs",
    "pageElementIdIsClicked",
    "pageElementIsClicked",
    "pageButtonIsClicked",
    "pageTextIsTypedInto",
    "pageEnterIsPressedIn",
]);

export const then = stepsOf("Then", [
    "pageShouldHaveTitle",
    "pageElementTextShouldBe",
    "pageElementTextShouldContain",
    "pageElementCountShouldBe",
    "pageElementAttributeShouldBe",
    "pageElementMarginShouldBe",
    "pageElementPaddingShouldBe",
    "pageElementFontFamilyShouldBe",
    "pageElementFontSizeShouldBe",
    "pageElementFontWeightShouldBe",
    "pageElementXShouldBe",
    "pageElementYShouldBe",
    "pageElementWidthShouldBe",
    "pageElementHeightShouldBe",
    "pageElementTopShouldBe",
    "pageElementLeftShouldBe",
    "pageElementBackgroundColorShouldBe",
    "pageElementColorShouldBe",
    "pageElementStyleShouldBe",
    "pageIsClosed",
]);

export function scenario(name, ...steps) {
    return { scenario: name, steps };
}

export function feature(name, ...scenarios) {
    return { feature: name, scenarios };
}
