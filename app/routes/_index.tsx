import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useEffect } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import { DeploymentAlerts, DeploymentToasts } from '~/components/ui/DeploymentAlerts';
import { reset } from '~/lib/stores/chat';

export const meta: MetaFunction = () => {
  return [{ title: 'Bolt' }, { name: 'description', content: 'Talk with Bolt, an AI assistant from StackBlitz' }];
};

export const loader = () => json({});

export default function Index() {
  useEffect(() => {
    reset();
  }, []);

  return (
    <div className="flex flex-col h-full w-full">
      <Header />
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
      <ClientOnly fallback={null}>
        {() => (
          <>
            <DeploymentToasts />
            <DeploymentAlerts />
          </>
        )}
      </ClientOnly>
    </div>
  );
}
