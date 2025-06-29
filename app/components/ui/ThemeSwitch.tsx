import { useStore } from '@nanostores/react';
import { memo, useEffect, useState } from 'react';
import { IconButton } from './IconButton';
import { themeStore, toggleTheme } from '~/lib/stores/theme';

interface ThemeSwitchProps {
  className?: string;
}

export const ThemeSwitch = memo(({ className }: ThemeSwitchProps) => {
  const themeState = useStore(themeStore.state);
  const [domLoaded, setDomLoaded] = useState(false);

  useEffect(() => {
    setDomLoaded(true);
  }, []);

  const effectiveTheme = themeState.current === 'auto' ? themeState.systemPreference : themeState.current;

  return (
    domLoaded && (
      <IconButton
        className={className}
        icon={effectiveTheme === 'dark' ? 'i-ph-sun-dim-duotone' : 'i-ph-moon-stars-duotone'}
        size="xl"
        title="Toggle Theme"
        onClick={toggleTheme}
      />
    )
  );
});
