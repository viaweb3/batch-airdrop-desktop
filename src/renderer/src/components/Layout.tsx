import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

interface PriceInfo {
  eth: number;
  matic: number;
  sol: number;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [priceInfo, setPriceInfo] = useState<PriceInfo>({ eth: 0, matic: 0, sol: 0 });
  const [gasPrices, setGasPrices] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    // 初始化价格数据
    updatePrices();

    // 设置定时更新
    const interval = setInterval(updatePrices, 30000); // 30秒更新一次

    return () => clearInterval(interval);
  }, []);

  const updatePrices = async () => {
    try {
      if (window.electronAPI?.price) {
        // 获取主要代币价格
        const prices = await window.electronAPI.price.getPrices(['ETH', 'MATIC', 'SOL']);
        setPriceInfo({
          eth: prices.ETH || 0,
          matic: prices.MATIC || 0,
          sol: prices.SOL || 0
        });

        // 获取Gas价格 - 使用新的gas服务
        try {
          const chains = await window.electronAPI.chain.getEVMChains(true);
          const ethChain = chains.find(c => c.name.toLowerCase().includes('ethereum'));
          const polygonChain = chains.find(c => c.name.toLowerCase().includes('polygon'));

          if (ethChain && priceInfo.eth > 0) {
            const ethGasInfo = await window.electronAPI.gas.getInfo(ethChain.rpcUrl, 'ethereum', priceInfo.eth);
            if (ethGasInfo.gasPrice) {
              setGasPrices(prev => ({
                ...prev,
                'ethereum': parseFloat(ethGasInfo.gasPrice)
              }));
            }
          }

          if (polygonChain && priceInfo.matic > 0) {
            const polygonGasInfo = await window.electronAPI.gas.getInfo(polygonChain.rpcUrl, 'polygon', priceInfo.matic);
            if (polygonGasInfo.gasPrice) {
              setGasPrices(prev => ({
                ...prev,
                'polygon': parseFloat(polygonGasInfo.gasPrice)
              }));
            }
          }
        } catch (error) {
          console.error('Failed to fetch gas prices:', error);
        }
      }
    } catch (error) {
      console.error('Failed to update prices:', error);
    }
  };

  const navItems = [
    { path: '/', label: '📊 仪表盘', icon: '📊' },
    { path: '/campaign/create', label: '➕ 新建活动', icon: '➕' },
    { path: '/history', label: '📜 历史', icon: '📜' },
    { path: '/settings', label: '⚙️ 设置', icon: '⚙️' },
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatGasPrice = (gasPrice: number) => {
    return `${gasPrice.toFixed(0)} Gwei`;
  };

  return (
    <div className="flex h-screen bg-cryptocast-dark text-white">
      {/* 侧边栏 */}
      <aside className="w-64 bg-cryptocast-secondary p-4">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-cryptocast-purple">CryptoCast</h1>
          <p className="text-sm text-gray-400">v1.0.0</p>
        </div>

        {/* 价格显示 */}
        <div className="mb-6 p-3 bg-gray-700 rounded-lg">
          <h3 className="text-sm font-semibold mb-3 text-gray-300">实时价格</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">ETH:</span>
              <span className="font-mono">{formatPrice(priceInfo.eth)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">MATIC:</span>
              <span className="font-mono">{formatPrice(priceInfo.matic)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">SOL:</span>
              <span className="font-mono">{formatPrice(priceInfo.sol)}</span>
            </div>
          </div>
        </div>

        {/* Gas价格显示 */}
        <div className="mb-6 p-3 bg-gray-700 rounded-lg">
          <h3 className="text-sm font-semibold mb-3 text-gray-300">Gas价格</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Ethereum:</span>
              <span className="font-mono text-yellow-400">{gasPrices.ethereum ? formatGasPrice(gasPrices.ethereum) : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Polygon:</span>
              <span className="font-mono text-green-400">{gasPrices.polygon ? formatGasPrice(gasPrices.polygon) : 'N/A'}</span>
            </div>
          </div>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-4 py-3 rounded-lg transition-colors ${
                location.pathname === item.path
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
                }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  );
}