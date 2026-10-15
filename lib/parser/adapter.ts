export interface FrameworkAdapter {
  name: string;
  isExcluded?: (filePath: string) => boolean;
  getEntryPoints?: (rootDir: string) => string[];
}

export const fallbackAdapter: FrameworkAdapter = {
  name: 'fallback',
};
