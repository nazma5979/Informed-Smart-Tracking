
import { useState, useEffect } from 'react';

interface NetworkInformation extends EventTarget {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  saveData: boolean;
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

interface AdaptiveConfig {
  isLowEndDevice: boolean;
  isSlowNetwork: boolean;
  isSaveDataMode: boolean;
}

export const useAdaptiveConfig = (): AdaptiveConfig => {
  const [config, setConfig] = useState<AdaptiveConfig>({
    isLowEndDevice: false,
    isSlowNetwork: false,
    isSaveDataMode: false,
  });

  useEffect(() => {
    // 1. Hardware Detection
    // Logic: If device has < 4GB RAM or < 4 logical cores, treat as low-end.
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    const deviceMemory = (navigator as any).deviceMemory || 8; // Default to high if unsupported
    
    const isLowEnd = hardwareConcurrency < 4 || deviceMemory < 4;

    // 2. Network Detection
    const connection = (navigator as any).connection as NetworkInformation;
    let isSlow = false;
    let isSaveData = false;

    const updateNetworkInfo = () => {
      if (connection) {
        // slow-2g, 2g, and 3g are considered slow for heavy JS/Charts
        isSlow = ['slow-2g', '2g', '3g'].includes(connection.effectiveType);
        isSaveData = connection.saveData;
      }
      
      setConfig({
        isLowEndDevice: isLowEnd,
        isSlowNetwork: isSlow,
        isSaveDataMode: isSaveData
      });
    };

    updateNetworkInfo();

    if (connection) {
      connection.addEventListener('change', updateNetworkInfo);
      return () => connection.removeEventListener('change', updateNetworkInfo);
    }
  }, []);

  return config;
};
