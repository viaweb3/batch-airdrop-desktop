import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaign } from '../contexts/CampaignContext';

const { electronAPI } = window as any;

// 获取链的显示字母
function getChainInitial(name: string): string {
  const lowerName = name.toLowerCase();

  // 特殊链的显示字母
  if (lowerName.includes('ethereum') && lowerName.includes('sepolia')) return 'S'; // Sepolia
  if (lowerName.includes('ethereum')) return 'E'; // Ethereum Mainnet
  if (lowerName.includes('polygon')) return 'P'; // Polygon
  if (lowerName.includes('arbitrum')) return 'A'; // Arbitrum
  if (lowerName.includes('base')) return 'B'; // Base
  if (lowerName.includes('optimism')) return 'O'; // Optimism
  if (lowerName.includes('bsc') || lowerName.includes('binance')) return 'B'; // BSC
  if (lowerName.includes('avalanche')) return 'A'; // Avalanche
  if (lowerName.includes('solana')) return 'S'; // Solana

  // 默认使用名称的第一个字母
  return name.charAt(0)?.toUpperCase() || '⚡';
}

interface Campaign {
  id: string;
  name: string;
  chain: string;
  chainName?: string;
  tokenAddress: string;
  status: 'CREATED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  totalRecipients: number;
  completedRecipients: number;
  walletAddress?: string;
  contractAddress?: string;
  createdAt: string;
  updatedAt: string;
}

interface DashboardStats {
  totalActivities: number;
  successfulActivities: number;
  ongoingActivities: number;
  totalRecipients: number;
  completedRecipients: number;
  weeklyActivities: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { state, actions } = useCampaign();
  const [chains, setChains] = useState<any[]>([]);

  // Fetch chains from database on component mount
  useEffect(() => {
    const fetchChains = async () => {
      try {
        console.log('🔍 [Dashboard] fetchChains: Starting to fetch chains from database');
        const allChains: any[] = [];

        if (electronAPI?.chain) {
          // Load EVM chains
          const evmChains = await electronAPI.chain.getEVMChains();
          console.log(`🔍 [Dashboard] fetchChains: Received ${evmChains.length} EVM chains from API`);
          allChains.push(...evmChains);

          // Load Solana networks
          try {
            const solanaRPCs = await electronAPI.chain.getSolanaRPCs(undefined, true);
            console.log(`🔍 [Dashboard] fetchChains: Received ${solanaRPCs.length} Solana RPCs from API`);

            // Group by network and get the highest priority RPC for each network
            const networkMap = new Map<string, any>();
            solanaRPCs.forEach((rpc: any) => {
              const existing = networkMap.get(rpc.network);
              if (!existing || rpc.priority > existing.priority) {
                networkMap.set(rpc.network, rpc);
              }
            });

            // Convert Solana networks to chain format
            networkMap.forEach((rpc, network) => {
              const chainName = network === 'mainnet-beta' ? 'Solana Mainnet' :
                               network === 'devnet' ? 'Solana Devnet' :
                               network === 'testnet' ? 'Solana Testnet' :
                               `Solana ${network}`;

              allChains.push({
                name: chainName,
                chainId: `solana-${network}`,
                symbol: 'SOL',
                color: rpc.color || (network === 'mainnet-beta' ? '#00FFA3' : '#00D4AA'),
                badgeColor: rpc.badgeColor || 'badge-accent',
                type: 'solana',
                network: network
              });
            });
          } catch (error) {
            console.warn('🔍 [Dashboard] fetchChains: Failed to load Solana RPCs:', error);
          }

          console.log('🔍 [Dashboard] fetchChains: Total chains loaded:', allChains.length);
          console.log('🔍 [Dashboard] fetchChains: Chain data:', allChains.map(chain => ({
            name: chain.name,
            color: chain.color,
            badgeColor: chain.badgeColor,
            chainId: chain.chainId
          })));
          setChains(allChains);
          console.log('🔍 [Dashboard] fetchChains: Chains set to state');
        } else {
          console.log('🔍 [Dashboard] fetchChains: electronAPI.chain is not available');
        }
      } catch (error) {
        console.error('🔍 [Dashboard] fetchChains: Failed to load chains:', error);
      }
    };

    fetchChains();
  }, []);

  // Calculate stats from real campaign data
  const stats: DashboardStats = {
    totalActivities: state.campaigns.length,
    successfulActivities: state.campaigns.filter(c => c.status === 'COMPLETED').length,
    ongoingActivities: state.campaigns.filter(c => ['SENDING', 'PAUSED'].includes(c.status)).length,
    totalRecipients: state.campaigns.reduce((sum, c) => sum + c.totalRecipients, 0),
    completedRecipients: state.campaigns.reduce((sum, c) => sum + c.completedRecipients, 0),
    weeklyActivities: state.campaigns.filter(c => {
      const createdAt = new Date(c.createdAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return createdAt >= weekAgo;
    }).length
  };

  const activeCampaigns = state.campaigns.filter(c =>
    ['READY', 'SENDING', 'PAUSED'].includes(c.status)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <div className="badge badge-success gap-1">✅ 成功</div>;
      case 'SENDING':
        return <div className="badge badge-info gap-1">🔄 发送中</div>;
      case 'FAILED':
        return <div className="badge badge-error gap-1">❌ 失败</div>;
      case 'PAUSED':
        return <div className="badge badge-warning gap-1">⏸️ 暂停</div>;
      case 'READY':
        return <div className="badge badge-warning gap-1">⚡ 就绪</div>;
      default:
        return <div className="badge badge-neutral gap-1">📋 创建</div>;
    }
  };

  const getChainBadge = (chain: string, chainName?: string) => {
    const chainConfig = {
      '1': { badge: 'badge-info', name: 'Ethereum' },
      '137': { badge: 'badge-secondary', name: 'Polygon' },
      '42161': { badge: 'badge-info', name: 'Arbitrum' },
      '10': { badge: 'badge-error', name: 'Optimism' },
      '8453': { badge: 'badge-success', name: 'Base' },
      '56': { badge: 'badge-warning', name: 'BSC' },
      'solana': { badge: 'badge-accent', name: 'Solana' }
    };

    const config = chainConfig[chain as keyof typeof chainConfig] || { badge: 'badge-neutral', name: chainName || chain };
    return <div className={`badge ${config.badge} badge-sm`}>{config.name}</div>;
  };

  return (
    <div className="p-6">
      {/* Header with Stats Cards and New Campaign Button */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <h2 className="text-lg font-bold">数据概览</h2>
          </div>
          <button
            onClick={() => navigate('/campaign/create')}
            className="btn btn-primary"
          >
            ➕ 新建活动
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-figure text-primary">
              📋
            </div>
            <div className="stat-title">总活动数</div>
            <div className="stat-value text-primary">{stats.totalActivities}</div>
            <div className="stat-desc">
              <div className="flex items-center gap-1">
                <span className="text-success">📈</span>
                <span className="text-success">基于真实数据</span>
              </div>
            </div>
          </div>

          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-figure text-success">
              ✅
            </div>
            <div className="stat-title">成功发送</div>
            <div className="stat-value text-success">{stats.successfulActivities}</div>
            <div className="stat-desc">
              <div className="flex items-center gap-1">
                <span className="text-success">✅</span>
                <span className="text-success">成功完成的任务</span>
              </div>
            </div>
          </div>

          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-figure text-info">
              🔄
            </div>
            <div className="stat-title">进行中活动</div>
            <div className="stat-value text-info">{stats.ongoingActivities}</div>
            <div className="stat-desc">
              <div className="flex items-center gap-1">
                <span className="text-info">🔄</span>
                <span className="text-info">正在进行中</span>
              </div>
            </div>
          </div>

          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-figure text-warning">
              📅
            </div>
            <div className="stat-title">本周活动数</div>
            <div className="stat-value text-warning">{stats.weeklyActivities}</div>
            <div className="stat-desc">
              <div className="flex items-center gap-1">
                <span className="text-warning">📅</span>
                <span className="text-warning">本周内创建</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">⚡</span>
          <h2 className="text-lg font-bold">快速操作</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => navigate('/campaign/create')}
            className="card bg-base-100 shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-primary/20"
          >
            <div className="card-body p-4">
              <div className="card-actions justify-start">
                <div className="avatar placeholder">
                  <div className="bg-primary/10 text-primary rounded-full w-12 h-12">
                    <span className="text-lg">➕</span>
                  </div>
                </div>
              </div>
              <h3 className="card-title text-base mb-2">新建活动</h3>
            </div>
          </div>

          <div
            onClick={() => navigate('/history')}
            className="card bg-base-100 shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-primary/20"
          >
            <div className="card-body p-4">
              <div className="card-actions justify-start">
                <div className="avatar placeholder">
                  <div className="bg-secondary/10 text-secondary rounded-full w-12 h-12">
                    <span className="text-lg">📊</span>
                  </div>
                </div>
              </div>
              <h3 className="card-title text-base mb-2">查看历史</h3>
            </div>
          </div>

          <div
            onClick={() => navigate('/wallets')}
            className="card bg-base-100 shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-primary/20"
          >
            <div className="card-body p-4">
              <div className="card-actions justify-start">
                <div className="avatar placeholder">
                  <div className="bg-accent/10 text-accent rounded-full w-12 h-12">
                    <span className="text-lg">💳</span>
                  </div>
                </div>
              </div>
              <h3 className="card-title text-base mb-2">钱包管理</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Chain Activity Distribution */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">🔗</span>
          <h2 className="text-lg font-bold">链活动分布</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {(() => {
            // Calculate chain activity distribution from real campaign data
            const chainActivity = state.campaigns.reduce((acc, campaign) => {
              const chainId = campaign.chain;
              acc[chainId] = (acc[chainId] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            const totalActivities = state.campaigns.length;

            // Use real chain data from database
            return chains.map(chain => {
              // Match campaigns by chainId (EVM) or network identifier (Solana)
              let activityCount = 0;

              // For EVM chains, match by chainId
              if (chain.type === 'evm' && chain.chainId) {
                activityCount = chainActivity[chain.chainId.toString()] || 0;
              }
              // For Solana networks, match by network identifier (e.g., "mainnet-beta", "devnet")
              else if (chain.type === 'solana' && chain.network) {
                activityCount = chainActivity[chain.network] || 0;
              }
              // Fallback: try matching by the chainId string representation
              else if (chain.chainId) {
                activityCount = chainActivity[chain.chainId.toString()] || 0;
              }

              const percentage = totalActivities > 0 ? (activityCount / totalActivities * 100).toFixed(1) : '0.0';

              return (
                <div key={chain.id || chain.chainId} className="card bg-base-100 shadow-sm hover:shadow-md transition-all border-2 border-transparent hover:border-primary/20">
                  <div className="card-body p-3 text-center">
                    <div
                      className="text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold mx-auto mb-2"
                      style={{ backgroundColor: chain.color || '#3B82F6' }}
                    >
                      {getChainInitial(chain.name)}
                    </div>
                    <h3 className="card-title text-sm justify-center mb-1">{chain.name}</h3>
                    <div className={`badge ${chain.badgeColor || 'badge-primary'} badge-sm mb-1`}>{activityCount}</div>
                    <p className="text-xs text-base-content/60">{percentage}% 活动量</p>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}