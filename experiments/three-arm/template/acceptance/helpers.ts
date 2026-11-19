import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

export const PASSWORD = 'correct-horse-battery';

export const AT_LOGIN = /\/login(?:\?.*)?$/;

export const AT_HABITS = /\/habits(?:\?.*)?$/;

export interface Account {
  email: string;
  password: string;
}

export const newAccount = (): Account => ({
  email: `user-${Date.now()}-${Math.floor(Math.random() * 1e9)}@example.test`,
  password: PASSWORD,
});

export const utcDay = (daysAgo: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
};

export const button = (scope: Page | Locator, name: string): Locator =>
  scope.getByRole('button', { name, exact: true });

export const link = (scope: Page | Locator, name: string): Locator =>
  scope.getByRole('link', { name, exact: true });

export const field = (page: Page, label: string): Locator =>
  page.getByLabel(label, { exact: true });

export const heading = (page: Page, name: string): Locator =>
  page.getByRole('heading', { level: 1, name, exact: true });

export const message = (page: Page, text: string): Locator =>
  page.getByText(text).first();

export const signUp = async (page: Page, account: Account): Promise<void> => {
  await page.goto('/signup');
  await field(page, 'Email').fill(account.email);
  await field(page, 'Password').fill(account.password);
  await button(page, 'Create account').click();
  await expect(page).toHaveURL(AT_HABITS);
};

export const logIn = async (page: Page, account: Account): Promise<void> => {
  await page.goto('/login');
  await field(page, 'Email').fill(account.email);
  await field(page, 'Password').fill(account.password);
  await button(page, 'Log in').click();
};

export const logOut = async (page: Page): Promise<void> => {
  await button(page, 'Log out').click();
  await expect(page).toHaveURL(/\/$/);
};

export const addHabit = async (page: Page, name: string): Promise<void> => {
  await page.goto('/habits');
  await field(page, 'Habit name').fill(name);
  await button(page, 'Add habit').click();
  await expect(habitRow(page, name)).toBeVisible();
};

export const habitRow = (page: Page, name: string): Locator =>
  page.getByTestId('habit-row').filter({ has: link(page, name) });

export const openHabit = async (page: Page, name: string): Promise<void> => {
  await page.goto('/habits');
  await link(habitRow(page, name), name).click();
  await expect(heading(page, name)).toBeVisible();
};

export const historyDay = (page: Page, daysAgo: number): Locator =>
  page.locator(`[data-testid="history-day"][data-date="${utcDay(daysAgo)}"]`);

export const setDone = async (
  page: Page,
  daysAgo: number,
  done: boolean,
): Promise<void> => {
  const day = historyDay(page, daysAgo);
  await expect(day).toHaveAttribute('data-done', /true|false/);
  const current = await day.getAttribute('data-done');
  if (current !== String(done)) await day.click();
  await expect(day).toHaveAttribute('data-done', String(done));
};

export const markDays = async (
  page: Page,
  name: string,
  daysAgo: number[],
): Promise<void> => {
  await openHabit(page, name);
  for (const offset of daysAgo) await setDone(page, offset, true);
};
