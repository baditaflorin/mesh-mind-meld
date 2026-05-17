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
