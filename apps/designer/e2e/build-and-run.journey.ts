import { expect, test } from '@playwright/test';

/**
 * Build a question through the moves the fabric offers and run it: Jita,
 * jumpsTo, destination Amarr. The fixture answers 4 jumps.
 */
test('build a question from a subject and run it', async ({ page }) => {
  await page.goto('/#build');
  await expect(page.getByRole('button', { name: 'Build' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel('Kind').selectOption('system');
  await page.getByLabel('Name or id').fill('Jita');
  await page.getByLabel('Name or id').press('Enter');
  await expect(page.getByText('system Jita').first()).toBeVisible();

  // The canvas shows the one step so far.
  await expect(page.getByText('1 nodes, 0 edges')).toBeVisible();

  await page.getByRole('button', { name: 'jumpsTo', exact: true }).click();
  await expect(page.getByText('Still needed')).toBeVisible();
  await page.getByLabel('destination', { exact: true }).fill('Amarr');
  await page.getByRole('button', { name: 'Fill destination' }).click();

  // The filled destination becomes a step of its own, so three steps now.
  await expect(page.getByText('3 nodes, 2 edges')).toBeVisible();
  await expect(page.getByText(/jumpsTo\(destination: "Amarr"\)/)).toBeVisible();

  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByLabel('Answer')).toHaveText('4');

  // Undo takes the last change back, and the hole opens again.
  await page.getByRole('button', { name: 'Undo' }).first().click();
  await expect(page.getByText('Still needed')).toBeVisible();
});
