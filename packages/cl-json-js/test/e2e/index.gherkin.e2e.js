import {
    feature,
    scenario,
    given,
    when,
    then,
    runFeature,
} from "../../../../scripts/gherkin/index.js";
import { testPageName } from "../../../../scripts/testPageName.js";

const pageName = testPageName(import.meta.url);

const indexFeature = feature(
    "index page",
    scenario(
        "the home file renders a VIP card",
        given.pageNameIs(pageName),
        when.pageIsRendered(),
        then.pageShouldHaveTitle("cl-json-js"),
        then.pageElementTextShouldBe("#home h3", "Welcome back, Ann"),
        when.pageElementIs("#home .badge-vip"),
        then.pageElementColorShouldBe("rgb(161, 98, 7)"),
        then.pageElementFontWeightShouldBe("700"),
        then.pageIsClosed(),
    ),
    scenario(
        "one more coffee reaches free shipping",
        given.pageNameIs(pageName),
        when.pageIsRendered(),
        then.pageElementTextShouldContain("#cart .summary", "Total 33.40 €"),
        when.pageButtonIsClicked("+", "#cart tr:nth-child(2)"),
        then.pageElementTextShouldBe(
            "#cart .summary",
            "Subtotal 41.00 € · Shipping free · Total 41.00 €",
        ),
        then.pageElementCountShouldBe("#cart .hint", 0),
        then.pageIsClosed(),
    ),
    scenario(
        "multiples of 15 are FizzBuzz, on green",
        given.pageNameIs(pageName),
        when.pageIsRendered(),
        then.pageElementTextShouldContain("#fizzbuzz p strong", "30"),
        then.pageElementCountShouldBe("#fizzbuzz .fizzbuzz", 2),
        when.pageElementIs("#fizzbuzz .fizzbuzz"),
        then.pageElementBackgroundColorShouldBe("rgb(187, 247, 208)"),
        then.pageIsClosed(),
    ),
    scenario(
        "raising the chart target turns February red",
        given.pageNameIs(pageName),
        when.pageIsRendered(),
        then.pageElementTextShouldContain(
            "#chart p",
            "(4 of 6 months on target)",
        ),
        when.pageButtonIsClicked("+ 5", "#chart"),
        then.pageElementTextShouldContain(
            "#chart p",
            "(2 of 6 months on target)",
        ),
        then.pageElementAttributeShouldBe(
            "#chart g:nth-of-type(2) rect",
            "fill",
            "#dc2626",
        ),
        then.pageIsClosed(),
    ),
);

runFeature(indexFeature);

export default indexFeature;
