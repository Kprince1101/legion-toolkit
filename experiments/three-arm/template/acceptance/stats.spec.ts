import { expect, test } from '@playwright/test';
import {
  addHabit,
  heading,
  markDays,
  newAccount,
  signUp,
  utcDay,
} from './helpers';

test.describe('stats', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page, newAccount());
  });

  test('a new account has empty stats', async ({ page }) => {
    await page.goto('/stats');
    await expect(heading(page, 'Stats')).toBeVisible();
    await expect(page.getByTestId('stat-total-habits')).toHaveText('0');
    await expect(page.getByTestId('stat-week-completions')).toHaveText('0');
    await expect(page.getByTestId('stat-month-rate')).toHaveText('0%');
    await expect(page.getByTestId('stat-best-current-streak')).toHaveText(
      'None',
    );
    await expect(page.getByTestId('stat-longest-streak')).toHaveText('0');
  });

  test.describe('with two habits', () => {
    test.beforeEach(async ({ page }) => {
      await addHabit(page, 'Read');
      await addHabit(page, 'Swim');
      await markDays(page, 'Read', [2, 1, 0]);
      await markDays(page, 'Swim', [0, 12]);
      await page.goto('/stats');
    });

    test('the totals add up', async ({ page }) => {
      await expect(page.getByTestId('stat-total-habits')).toHaveText('2');
      await expect(page.getByTestId('stat-week-completions')).toHaveText('4');
      await expect(page.getByTestId('stat-month-rate')).toHaveText('8%');
      await expect(page.getByTestId('stat-best-current-streak')).toHaveText(
        'Read — 3',
      );
      await expect(page.getByTestId('stat-longest-streak')).toHaveText('3');
    });

    test('the heatmap counts completions per day', async ({ page }) => {
      const heatmap = page.getByTestId('heatmap');
      const days = heatmap.getByTestId('heatmap-day');
      await expect(days).toHaveCount(30);
      await expect(days.last()).toHaveAttribute('data-date', utcDay(0));
      const day = (daysAgo: number) =>
        heatmap.locator(
          `[data-testid="heatmap-day"][data-date="${utcDay(daysAgo)}"]`,
        );
      await expect(day(0)).toHaveAttribute('data-count', '2');
      await expect(day(1)).toHaveAttribute('data-count', '1');
      await expect(day(12)).toHaveAttribute('data-count', '1');
      await expect(day(5)).toHaveAttribute('data-count', '0');
    });

    test('the table sorts by a column both ways', async ({ page }) => {
      const table = page.getByTestId('habit-table');
      for (const header of [
        'Habit',
        'Current streak',
        'Longest streak',
        '30-day rate',
      ]) {
        await expect(
          table.getByRole('columnheader', { name: header }),
        ).toBeVisible();
      }
      const firstRow = table.getByRole('row').nth(1);
      const sort = table.getByRole('button', { name: 'Current streak' });
      await sort.click();
      await expect(firstRow).toContainText('Read');
      await sort.click();
      await expect(firstRow).toContainText('Swim');
    });
  });
});
