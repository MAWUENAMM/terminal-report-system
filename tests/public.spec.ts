import { test, expect } from "@playwright/test";
test("public navigation, request form and protected sign-in", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Request school access" }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  for (const name of ["About", "Contact", "Privacy", "Terms"])
    await expect(
      page.getByRole("contentinfo").getByRole("link", { name, exact: true }),
    ).toBeVisible();
  await page
    .getByRole("link", { name: "Request school access" })
    .first()
    .click();
  await expect(page.getByLabel("School or organisation")).toBeVisible();
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  await page.goto("/dashboard/settings");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("form")).toHaveAttribute("method", "post");
  await expect(page.locator("form")).toHaveAttribute("action", "/auth/login");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  expect((await request.get("/auth/login")).status()).toBe(405);
  expect(errors).toEqual([]);
});
