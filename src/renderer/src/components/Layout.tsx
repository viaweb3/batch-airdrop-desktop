import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const { electronAPI } = window as any;

interface LayoutProps {
  children: ReactNode;
}

interface PriceInfo {
  eth: number;
  bnb: number;
  pol: number;
  avax: number;
  sol: number;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [priceInfo, setPriceInfo] = useState<PriceInfo>({
    eth: 0,
    bnb: 0,
    pol: 0,
    avax: 0,
    sol: 0
  });

  // Fetch real-time prices on component mount and set up interval
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        console.log('[Layout] Fetching prices...');
        const prices = await electronAPI.price.getPrices(['ETH', 'BNB', 'POL', 'AVAX', 'SOL']);
        console.log('[Layout] Received prices:', prices);
        setPriceInfo({
          eth: prices.ETH || 0,
          bnb: prices.BNB || 0,
          pol: prices.POL || 0,
          avax: prices.AVAX || 0,
          sol: prices.SOL || 0
        });
        console.log('[Layout] Updated priceInfo state');
      } catch (error) {
        console.error('[Layout] Failed to fetch prices:', error);
      }
    };

    // Initial fetch
    fetchPrices();

    // Set up interval to fetch prices every 3 minutes (180000 ms)
    const interval = setInterval(fetchPrices, 180000);

    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { path: '/', label: '仪表盘', icon: '🏠' },
    { path: '/campaign/create', label: '活动', icon: '📊' },
    { path: '/history', label: '历史', icon: '📜' },
    { path: '/wallets', label: '钱包', icon: '👛' },
    { path: '/settings', label: '设置', icon: '⚙️' },
  ];

  const formatPrice = (price: number) => {
    if (price === 0) return '$--.--';
    return `$${price.toFixed(2)}`;
  };

  return (
    <div className="flex h-screen bg-base-200">
      {/* Sidebar - 180px width */}
      <aside className="w-[180px] bg-base-100 flex flex-col border-r border-base-300">
        {/* Logo Area */}
        <div className="p-5 border-b border-base-300">
          <h1 className="text-lg font-bold text-primary">CryptoCast</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="block mb-1"
            >
              <div className={`flex items-center gap-4 px-4 py-3 rounded-btn transition-all duration-200 ${
                location.pathname === item.path
                  ? 'bg-primary text-primary-content font-semibold'
                  : 'hover:bg-base-200 text-base-content'
              }`}>
                <span className={`text-xl ${location.pathname === item.path ? '' : 'opacity-70'}`}>
                  {item.icon}
                </span>
                <span className={`text-sm ${
                  location.pathname === item.path
                    ? 'font-semibold'
                    : ''
                }`}>
                  {item.label}
                </span>
              </div>
            </Link>
          ))}
        </nav>

        {/* Price & Gas Info - Bottom Section */}
        <div className="p-4 border-t border-base-300 space-y-4">
          {/* Prices */}
          <div className="bg-base-200 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">💰</span>
              <h3 className="text-xs font-semibold text-info uppercase tracking-wide">实时价格</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-medium">ETH</span>
                </div>
                <span className="text-xs font-bold text-primary">{formatPrice(priceInfo.eth)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <span className="text-xs font-medium">BNB</span>
                </div>
                <span className="text-xs font-bold text-primary">{formatPrice(priceInfo.bnb)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span className="text-xs font-medium">POL</span>
                </div>
                <span className="text-xs font-bold text-primary">{formatPrice(priceInfo.pol)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-xs font-medium">AVAX</span>
                </div>
                <span className="text-xs font-bold text-primary">{formatPrice(priceInfo.avax)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-medium">SOL</span>
                </div>
                <span className="text-xs font-bold text-primary">{formatPrice(priceInfo.sol)}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Page Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </main>
    </div>
  );
}