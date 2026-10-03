import { expect, test } from '@playwright/test';

const QUESTION = `{
  type(name: "Tritanium") {
    orders(region: "The Forge") {
      prices { lowestSell }
    }
  }
}`;

/**
 * Open a saved question: it comes up in Review, read-only, with its GraphQL,
 * plan and scaffold, and Run answers from the fixture.
 */
test('open a saved question and run it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Explore' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByLabel('GraphQL').fill(QUESTION);
  await page.getByRole('button', { name: 'Open', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Review' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page).toHaveURL(/#review$/);
  await expect(page.getByText('type Tritanium').first()).toBeVisible();
  // Read-only: the moves are not offered, the saved form and plan are shown.
  await expect(page.getByText('Next', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('tabpanel').or(page.getByText('Question as GraphQL'))).toBeVisible();
  await page.getByRole('tab', { name: 'Plan' }).click();
  await expect(page.getByText(/waits for:/).first()).toBeVisible();

  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByLabel('Answer')).toContainText('3.98');
});
