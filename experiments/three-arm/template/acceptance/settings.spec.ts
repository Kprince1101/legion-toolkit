import { expect, test } from '@playwright/test';
import {
  AT_HABITS,
  addHabit,
  logIn,
  logOut,
  newAccount,
  signUp,
} from './helpers';

test.describe('settings', () => {
  test('a wrong current password is refused', async ({ page }) => {
    await signUp(page, newAccount());
    await page.goto('/settings');
    await page.getByLabel('Current password').fill('not-the-password');
    await page.getByLabel('New password').fill('a-brand-new-password');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('Current password is incorrect')).toBeVisible();
  });

  test('a changed password is the one that logs in', async ({ page }) => {
    const account = newAccount();
    const changed = { ...account, password: 'a-brand-new-password' };
    await signUp(page, account);
    await page.goto('/settings');
    await page.getByLabel('Current password').fill(account.password);
    await page.getByLabel('New password').fill(changed.password);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('Password updated')).toBeVisible();
    await logOut(page);
    await logIn(page, account);
    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await logIn(page, changed);
    await expect(page).toHaveURL(AT_HABITS);
  });

  test('deleting the account needs a confirmation and removes it', async ({
    page,
  }) => {
    const account = newAccount();
    await signUp(page, account);
    await addHabit(page, 'Sketch');
    await page.goto('/settings');
    await page
      .getByRole('button', { name: 'Delete account', exact: true })
      .click();
    await page.getByRole('button', { name: 'Confirm delete account' }).click();
    await expect(page).toHaveURL(/\/$/);
    await logIn(page, account);
    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });
});

test.describe('isolation', () => {
  test("one user never sees another user's habits", async ({
    page,
    browser,
  }) => {
    await signUp(page, newAccount());
    await addHabit(page, 'Private habit');
    await page
      .getByTestId('habit-row')
      .getByRole('link', { name: 'Private habit' })
      .click();
    const habitUrl = page.url();

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signUp(otherPage, newAccount());
    await expect(otherPage.getByTestId('habit-row')).toHaveCount(0);
    const response = await otherPage.goto(habitUrl);
    expect(response?.status()).toBe(404);
    await expect(otherPage.getByText('Habit not found')).toBeVisible();
    await other.close();
  });
});
