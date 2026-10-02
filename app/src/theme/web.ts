// Opt a view into a premium web-only surface defined in src/lib/webStyles.ts (layered gradients / glow / blur).
export const web = (tag: string) => ({ dataSet: { tapp: tag } }) as object;
