import { expect, test } from '@playwright/test';

/**
 * Compose a question on the canvas: drag the subject onto the empty canvas,
 * drag a move onto the scaffold, fill the hole it opens, run it, save it.
 * Every gesture is a change the fabric is asked for, so the saved form is
 * the same GraphQL the panel would have built.
 */
test('compose a two-step question by drag and drop, run it and save it', async ({ page }) => {
  await page.goto('/#build');
  const canvas = page.getByTestId('canvas');
  await expect(canvas.getByText('Drop a subject here')).toBeVisible();

  await page.getByLabel('Kind').selectOption('system');
  await page.getByLabel('Name or id').fill('Jita');
  await page.getByRole('button', { name: 'Start' }).dragTo(canvas);
  await expect(page.getByText('system Jita').first()).toBeVisible();
  await expect(page.getByText('1 nodes, 0 edges')).toBeVisible();

  await page.getByRole('button', { name: 'jumpsTo', exact: true }).dragTo(canvas);
  await expect(page.getByText('Still needed')).toBeVisible();
  await page.getByLabel('destination', { exact: true }).fill('Amarr');
  // Once the fabric has listed Amarr among the choices, the typed name is
  // filled as that choice's id, so the hole closes in one step.
  await expect(page.locator('datalist option[value="Amarr"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Fill destination' }).click();
  await expect(page.getByText('2 nodes, 1 edges')).toBeVisible();

  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByLabel('Answer')).toHaveText('4');

  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save as GraphQL' }).click();
  expect((await saved).suggestedFilename()).toBe('question.graphql');
});
