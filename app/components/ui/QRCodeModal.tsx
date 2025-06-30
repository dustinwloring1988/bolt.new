import { useStore } from '@nanostores/react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { DialogRoot, Dialog, DialogTitle, DialogDescription, DialogButton } from './Dialog';
import { qrCodeStore, hideQRCode } from '~/lib/stores/qrCode';

export function QRCodeModal() {
  const { url, isVisible } = useStore(qrCodeStore);
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('');

  useEffect(() => {
    if (url && isVisible) {
      QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
        .then(setQrCodeDataURL)
        .catch(console.error);
    }
  }, [url, isVisible]);

  const handleClose = () => {
    hideQRCode();
    setQrCodeDataURL('');
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <DialogRoot open={isVisible}>
      <Dialog onClose={handleClose} className="w-auto max-w-md">
        <div className="p-6 text-center">
          <DialogTitle className="text-xl font-semibold mb-2 text-bolt-elements-textPrimary">
            Open on Your Device
          </DialogTitle>

          <DialogDescription className="text-bolt-elements-textSecondary mb-6">
            Scan this QR code with your Expo Go app to open the project on your mobile device
          </DialogDescription>

          {qrCodeDataURL && (
            <div className="mb-6 flex justify-center">
              <div className="p-4 bg-white rounded-lg shadow-sm">
                <img src={qrCodeDataURL} alt="QR Code for Expo app" className="w-64 h-64" />
              </div>
            </div>
          )}

          <div className="mb-6 p-3 bg-bolt-elements-bg-depth-2 rounded-lg border border-bolt-elements-borderColor">
            <code className="text-sm text-bolt-elements-textSecondary break-all">{url}</code>
          </div>

          <div className="flex gap-3 justify-center">
            <DialogButton
              type="secondary"
              onClick={copyToClipboard}
              className="bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover text-bolt-elements-button-secondary-text px-4 py-2 rounded-lg"
            >
              Copy URL
            </DialogButton>
            <DialogButton
              type="primary"
              onClick={handleClose}
              className="bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text px-4 py-2 rounded-lg"
            >
              Close
            </DialogButton>
          </div>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
