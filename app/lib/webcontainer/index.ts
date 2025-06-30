import { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';

interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

export let webcontainer: Promise<WebContainer> = new Promise(() => {
  // noop for ssr
});

if (!import.meta.env.SSR) {
  webcontainer =
    import.meta.hot?.data.webcontainer ??
    Promise.resolve()
      .then(() => {
        return WebContainer.boot({ workdirName: WORK_DIR_NAME });
      })
      .then((webcontainer) => {
        webcontainerContext.loaded = true;
        return webcontainer;
      });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = webcontainer;
  }
}

export async function syncSupabaseEnv(url: string, key: string) {
  const container = await webcontainer;
  // Write .env file
  await container.fs.writeFile('.env', `SUPABASE_URL=${url}\nSUPABASE_KEY=${key}\n`);

  // Check if @supabase/supabase-js is installed
  let pkgJson;

  try {
    pkgJson = JSON.parse(await container.fs.readFile('package.json', 'utf8'));
  } catch {
    pkgJson = { dependencies: {} };
  }

  if (!pkgJson.dependencies || !pkgJson.dependencies['@supabase/supabase-js']) {
    // Install package
    const proc = await container.spawn('pnpm', ['add', '@supabase/supabase-js']);
    await proc.exit;
  }
}

if (typeof window !== 'undefined') {
  window.syncSupabaseEnv = syncSupabaseEnv;
}

declare global {
  interface Window {
    syncSupabaseEnv?: (url: string, key: string) => Promise<void>;
  }
}
