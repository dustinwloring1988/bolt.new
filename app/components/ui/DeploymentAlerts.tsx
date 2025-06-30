import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconButton } from './IconButton';
import {
  deploymentAlerts,
  showDeploymentAlerts,
  removeDeploymentAlert,
  hideDeploymentAlerts,
  type DeploymentAlert,
} from '~/lib/stores/deploymentAlerts';

const alertVariants = {
  initial: { opacity: 0, y: -50, scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.95 },
};

const panelVariants = {
  hidden: { opacity: 0, x: 300 },
  visible: { opacity: 1, x: 0 },
};

function getAlertIcon(type: DeploymentAlert['type']) {
  switch (type) {
    case 'success':
      return 'i-ph:check-circle-duotone';
    case 'error':
      return 'i-ph:x-circle-duotone';
    case 'warning':
      return 'i-ph:warning-circle-duotone';
    case 'info':
    default:
      return 'i-ph:info-duotone';
  }
}

function getAlertColors(type: DeploymentAlert['type']) {
  switch (type) {
    case 'success':
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: 'text-green-600',
        title: 'text-green-800',
        message: 'text-green-700',
      };
    case 'error':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: 'text-red-600',
        title: 'text-red-800',
        message: 'text-red-700',
      };
    case 'warning':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        icon: 'text-yellow-600',
        title: 'text-yellow-800',
        message: 'text-yellow-700',
      };
    case 'info':
    default:
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        icon: 'text-blue-600',
        title: 'text-blue-800',
        message: 'text-blue-700',
      };
  }
}

function getProviderIcon(provider: DeploymentAlert['provider']) {
  switch (provider) {
    case 'netlify':
      return 'i-ph:rocket-launch-duotone';
    case 'vercel':
      return 'i-ph:cloud-arrow-up-duotone';
    case 'github-pages':
      return 'i-ph:git-branch-duotone';
    default:
      return 'i-ph:globe-duotone';
  }
}

function DeploymentAlertItem({ alert }: { alert: DeploymentAlert }) {
  const colors = getAlertColors(alert.type);
  const alertIcon = getAlertIcon(alert.type);
  const providerIcon = getProviderIcon(alert.provider);

  const handleDismiss = () => {
    removeDeploymentAlert(alert.id);
  };

  const handleOpenUrl = () => {
    if (alert.deploymentUrl) {
      window.open(alert.deploymentUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <motion.div
      layout
      variants={alertVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`p-4 rounded-lg border ${colors.bg} ${colors.border} shadow-sm mb-3`}
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2">
          <span className={`${alertIcon} text-lg ${colors.icon}`} />
          <span className={`${providerIcon} text-sm ${colors.icon}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className={`font-medium text-sm ${colors.title}`}>{alert.title}</h4>
            <div className="flex items-center gap-1">
              {alert.status === 'deploying' && (
                <div className="animate-spin w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full" />
              )}
              <IconButton icon="i-ph:x" size="sm" onClick={handleDismiss} className="hover:bg-gray-100" />
            </div>
          </div>

          <p className={`text-sm mt-1 ${colors.message}`}>{alert.message}</p>

          {alert.deploymentUrl && (
            <button
              onClick={handleOpenUrl}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
            >
              <span className="i-ph:external-link-duotone" />
              View Deployment
            </button>
          )}

          <div className="text-xs text-gray-500 mt-2">{new Date(alert.timestamp).toLocaleTimeString()}</div>
        </div>
      </div>
    </motion.div>
  );
}

export function DeploymentAlerts() {
  const alerts = useStore(deploymentAlerts);
  const showAlerts = useStore(showDeploymentAlerts);

  const alertList = Object.values(alerts).sort((a, b) => b.timestamp - a.timestamp);

  if (!showAlerts || alertList.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={panelVariants}
      className="fixed top-20 right-4 w-80 max-h-96 overflow-y-auto z-50"
    >
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <span className="i-ph:bell-duotone text-lg" />
            Deployment Alerts
          </h3>
          <IconButton icon="i-ph:x" size="sm" onClick={hideDeploymentAlerts} className="hover:bg-gray-100" />
        </div>

        <AnimatePresence mode="popLayout">
          {alertList.map((alert) => (
            <DeploymentAlertItem key={alert.id} alert={alert} />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// toast-style alerts that appear at the top of the screen
export function DeploymentToasts() {
  const alerts = useStore(deploymentAlerts);

  // only show recent alerts (last 30 seconds) as toasts
  const recentAlerts = Object.values(alerts)
    .filter((alert) => Date.now() - alert.timestamp < 30000)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3); // limit to 3 toasts

  return (
    <div className="fixed top-4 right-4 w-80 z-50 space-y-2">
      <AnimatePresence>
        {recentAlerts.map((alert) => {
          const colors = getAlertColors(alert.type);

          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -50, x: 50 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, y: -20, x: 50 }}
              className={`p-3 rounded-lg border ${colors.bg} ${colors.border} shadow-lg`}
            >
              <div className="flex items-center gap-3">
                <span className={`${getAlertIcon(alert.type)} text-lg ${colors.icon}`} />
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm ${colors.title}`}>{alert.title}</p>
                  <p className={`text-xs ${colors.message} truncate`}>{alert.message}</p>
                </div>
                <IconButton
                  icon="i-ph:x"
                  size="sm"
                  onClick={() => removeDeploymentAlert(alert.id)}
                  className="hover:bg-gray-100 opacity-70 hover:opacity-100"
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
