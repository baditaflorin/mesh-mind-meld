import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("both peers submit same word → MELD message appears on both", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(600);

    await a.getByRole("button", { name: "start", exact: true }).click();
    await b.waitForTimeout(400);

    await a.getByPlaceholder("your word").fill("apple");
    await a.getByRole("button", { name: "submit word", exact: true }).click();
    await b.getByPlaceholder("your word").fill("apple");
    await b.getByRole("button", { name: "submit word", exact: true }).click();
    await b.waitForTimeout(700);

    await expect(b.locator(".meld-screen")).toContainText("MELD");
    await expect(a.locator(".meld-screen")).toContainText("MELD");
  } finally {
    await cleanup();
  }
});

test("a mismatch on the pair becomes the new category on the OPPOSITE peer", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(600);

    await a.getByRole("button", { name: "start", exact: true }).click();
    await b.waitForTimeout(400);

    // Both peers start in the advertised "fruit" category.
    await expect(a.locator(".meld-category strong")).toHaveText("fruit");
    await expect(b.locator(".meld-category strong")).toHaveText("fruit");

    // The pair submits two DIFFERENT words → mismatch. The merged
    // "newword" category is written by ONE peer (pairA) into the shared
    // `state` Y.Map; the advertised behaviour is that it becomes the new
    // category for the WHOLE room. The pair is shuffled, so drive both
    // peers' inputs — only the two paired peers have a visible word box.
    const fillIfPresent = async (page: typeof a, word: string) => {
      const box = page.getByPlaceholder("your word");
      if ((await box.count()) > 0 && (await box.isVisible())) {
        await box.fill(word);
        await page.getByRole("button", { name: "submit word", exact: true }).click();
      }
    };
    await fillIfPresent(a, "lemon");
    await fillIfPresent(b, "olive");
    await b.waitForTimeout(700);

    // reveal screen shows the mismatch on both peers, then after the
    // 2000ms timeout the new category propagates. Two possible merged
    // strings depending on which peer the fair-RNG named pairA.
    const newCat = /^(lemon\+olive|olive\+lemon)$/;

    // The OPPOSITE-peer assertion: peer B (who did NOT necessarily author
    // the state write) sees the merged category cross the mesh, round 2,
    // and a fresh word box (submissions cleared). Reading the result on
    // the peer that did NOT run the transact is what makes this load-
    // bearing for cross-peer `state` Y.Map propagation.
    await expect(b.locator(".meld-category strong")).toHaveText(newCat, { timeout: 6000 });
    await expect(a.locator(".meld-category strong")).toHaveText(newCat, { timeout: 6000 });
    await expect(b.locator(".meld-cat-label")).toContainText("round 2");
    await expect(a.locator(".meld-cat-label")).toContainText("round 2");
  } finally {
    await cleanup();
  }
});
