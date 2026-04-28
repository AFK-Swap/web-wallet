// Wallet Mode Management System
export type WalletMode = 'web' | 'mobile';
export type InterfaceType = 'vr-optimized' | 'mobile-responsive' | 'qr-display';

export interface WalletModeConfig {
  mode: WalletMode;
  interface: InterfaceType;
  features: {
    directInteraction: boolean;
    qrCodeRequired: boolean;
    mobileAppRequired: boolean;
    overlaySupport: boolean;
  };
}

export const WALLET_MODES: Record<WalletMode, WalletModeConfig> = {
  web: {
    mode: 'web',
    interface: 'vr-optimized',
    features: {
      directInteraction: true,
      qrCodeRequired: false,
      mobileAppRequired: false,
      overlaySupport: true,
    }
  },
  mobile: {
    mode: 'mobile',
    interface: 'qr-display',
    features: {
      directInteraction: false,
      qrCodeRequired: true,
      mobileAppRequired: true,
      overlaySupport: false,
    }
  }
};

export class WalletModeManager {
  private currentMode: WalletMode = 'web';
  private callbacks: ((mode: WalletMode) => void)[] = [];

  getCurrentMode(): WalletMode {
    return this.currentMode;
  }

  getCurrentConfig(): WalletModeConfig {
    return WALLET_MODES[this.currentMode];
  }

  switchMode(newMode: WalletMode): void {
    if (newMode !== this.currentMode) {
      console.log(`Switching wallet mode: ${this.currentMode} → ${newMode}`);
      this.currentMode = newMode;
      
      // Notify all subscribers
      this.callbacks.forEach(callback => callback(newMode));
      
      // Store in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('walletMode', newMode);
      }
    }
  }

  onModeChange(callback: (mode: WalletMode) => void): () => void {
    this.callbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  initializeFromStorage(): void {
    if (typeof window !== 'undefined') {
      const storedMode = localStorage.getItem('walletMode') as WalletMode;
      if (storedMode && WALLET_MODES[storedMode]) {
        this.currentMode = storedMode;
      }
    }
  }

  getStatus(): {
    mode: WalletMode;
    interface: InterfaceType;
    timestamp: string;
    features: string[];
  } {
    const config = this.getCurrentConfig();
    return {
      mode: this.currentMode,
      interface: config.interface,
      timestamp: new Date().toISOString(),
      features: Object.entries(config.features)
        .filter(([_, enabled]) => enabled)
        .map(([feature, _]) => feature)
    };
  }
}

// Global instance
export const walletModeManager = new WalletModeManager();