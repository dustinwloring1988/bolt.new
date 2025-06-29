import { atom } from 'nanostores';

export interface QRCodeData {
  url: string;
  isVisible: boolean;
}

// Store for managing QR code modal state
export const qrCodeStore = atom<QRCodeData>({
  url: '',
  isVisible: false,
});

// Actions
export const showQRCode = (url: string) => {
  qrCodeStore.set({
    url,
    isVisible: true,
  });
};

export const hideQRCode = () => {
  qrCodeStore.set({
    url: '',
    isVisible: false,
  });
};

// Expo URL detection pattern
const EXPO_URL_PATTERN = /exp:\/\/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}:[0-9]+/g;

export const detectExpoUrl = (text: string): string | null => {
  const matches = text.match(EXPO_URL_PATTERN);
  return matches ? matches[0] : null;
};
