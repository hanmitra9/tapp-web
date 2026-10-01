import NetInfo from '@react-native-community/netinfo';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const NetworkContext = createContext(true);   // assume online until the first check lands

// Reflects real connectivity, not just "wifi/cellular is on" — isInternetReachable is false
// when connected to a network with no actual internet (captive portal, dead router).
export function NetworkProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return unsub;
  }, []);
  return <NetworkContext.Provider value={online}>{children}</NetworkContext.Provider>;
}

export const useOnline = () => useContext(NetworkContext);
