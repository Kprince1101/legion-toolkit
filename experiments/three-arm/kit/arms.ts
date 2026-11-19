export type Arm = 'raw' | 'prose' | 'steered';

export const ARMS: Arm[] = ['raw', 'prose', 'steered'];

const ARM_NAMES = new Set<string>(ARMS);

export const isArm = (value: string): value is Arm => ARM_NAMES.has(value);
