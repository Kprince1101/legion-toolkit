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

export const signUp = async (page: Page, account: Account): Promise<void> => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(AT_HABITS);
};

export const logIn = async (page: Page, account: Account): Promise<void> => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Log in' }).click();
};

export const logOut = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/$/);
};

export const addHabit = async (page: Page, name: string): Promise<void> => {
  await page.goto('/habits');
  await page.getByLabel('Habit name').fill(name);
  await page.getByRole('button', { name: 'Add habit' }).click();
  await expect(habitRow(page, name)).toBeVisible();
};

export const habitRow = (page: Page, name: string): Locator =>
  page.getByTestId('habit-row').filter({ hasText: name });

export const openHabit = async (page: Page, name: string): Promise<void> => {
  await page.goto('/habits');
  await habitRow(page, name).getByRole('link', { name }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
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
