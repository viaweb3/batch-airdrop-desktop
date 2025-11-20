import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Campaign {
  id: string;
  name: string;
  chain: string;
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
  totalCampaigns: number;
  completedCampaigns: number;
  totalRecipients: number;
  completedRecipients: number;
  totalGasUsed: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCampaigns: 0,
    completedCampaigns: 0,
    totalRecipients: 0,
    completedRecipients: 0,
    totalGasUsed: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      if (window.electronAPI?.campaign) {
        const campaignList = await window.electronAPI.campaign.list();
        setCampaigns(campaignList);

        // 计算统计数据
        const dashboardStats: DashboardStats = {
          totalCampaigns: campaignList.length,
          completedCampaigns: campaignList.filter(c => c.status === 'COMPLETED').length,
          totalRecipients: campaignList.reduce((sum, c) => sum + c.totalRecipients, 0),
          completedRecipients: campaignList.reduce((sum, c) => sum + c.completedRecipients, 0),
          totalGasUsed: 0 // 这里需要从交易记录中计算，暂时设为0
        };

        setStats(dashboardStats);
      }
    } catch (error) {
      console.error('加载仪表盘数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'badge-accent';
      case 'SENDING': return 'badge-warning';
      case 'FAILED': return 'badge-error';
      case 'PAUSED': return 'badge-warning';
      case 'READY': return 'badge-info';
      default: return 'badge-ghost';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'CREATED': return '已创建';
      case 'READY': return '就绪';
      case 'SENDING': return '发送中';
      case 'PAUSED': return '已暂停';
      case 'COMPLETED': return '已完成';
      case 'FAILED': return '失败';
      default: return '未知';
    }
  };

  const getChainName = (chainId: string) => {
    const chains: Record<string, string> = {
      '1': 'Ethereum',
      '137': 'Polygon',
      '56': 'BSC',
      '43114': 'Avalanche',
      '250': 'Fantom'
    };
    return chains[chainId] || `Chain ${chainId}`;
  };

  const activeCampaigns = campaigns.filter(c =>
    ['READY', 'SENDING', 'PAUSED'].includes(c.status)
  );

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">仪表盘</h1>
        <div className="text-center py-12">
          <div className="text-gray-400">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Hero Section with Enhanced Welcome Banner */}
      <div className="mb-8 relative overflow-hidden rounded-3xl bg-cryptocast-gradient p-6 md:p-8 shadow-cryptocast-xl cryptocast-glow-purple">
        <div className="absolute inset-0 bg-cryptocast-gradient-shimmer opacity-20"></div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mb-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-3 text-cryptocast-white cryptocast-shimmer">
                欢迎回来
              </h1>
              <p className="text-lg text-cryptocast-white/90 font-medium">通过 CryptoCast 管理您的加密货币空投活动</p>
            </div>
            <button
              onClick={() => navigate('/campaign/create')}
              className="btn-cryptocast shadow-cryptocast-xl hover:shadow-glow-purple transition-all flex items-center gap-3 text-lg px-6 py-4"
            >
              <span className="text-2xl">➕</span>
              创建新活动
            </button>
          </div>

          {/* Enhanced Quick Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="glass p-6 rounded-2xl text-center hover:scale-105 transition-cryptocast">
              <div className="text-4xl md:text-5xl font-bold text-cryptocast-white mb-2">{stats.totalCampaigns}</div>
              <div className="text-sm text-cryptocast-white/80 font-medium">活动总数</div>
            </div>
            <div className="glass p-6 rounded-2xl text-center hover:scale-105 transition-cryptocast">
              <div className="text-4xl md:text-5xl font-bold text-cryptocast-green-bright mb-2">{stats.completedCampaigns}</div>
              <div className="text-sm text-cryptocast-white/80 font-medium">已完成</div>
            </div>
            <div className="glass p-6 rounded-2xl text-center hover:scale-105 transition-cryptocast">
              <div className="text-4xl md:text-5xl font-bold text-cryptocast-cyan-bright mb-2">{stats.totalRecipients.toLocaleString()}</div>
              <div className="text-sm text-cryptocast-white/80 font-medium">总接收地址</div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Detailed Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card-cryptocast p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="glass px-3 py-1 rounded-full">
              <span className="text-sm font-medium text-cryptocast-purple">活动</span>
            </div>
            <div className="text-5xl text-cryptocast-purple opacity-60">📊</div>
          </div>
          <div className="text-5xl font-bold text-cryptocast-white mb-3 cryptocast-shimmer">{stats.totalCampaigns}</div>
          <div className="text-base text-cryptocast-secondary font-medium mb-4">总活动数</div>
          <div className="flex items-center gap-3">
            <div className="h-3 flex-1 bg-cryptocast-bg-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-cryptocast-gradient rounded-full cryptocast-shimmer" style={{width: '100%'}}></div>
            </div>
            <span className="text-sm text-cryptocast-green font-bold">100%</span>
          </div>
        </div>

        <div className="card-cryptocast p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="glass px-3 py-1 rounded-full">
              <span className="text-sm font-medium text-cryptocast-green">完成</span>
            </div>
            <div className="text-5xl text-cryptocast-green opacity-60">✅</div>
          </div>
          <div className="text-5xl font-bold text-cryptocast-white mb-3 cryptocast-shimmer">{stats.completedCampaigns}</div>
          <div className="text-base text-cryptocast-secondary font-medium mb-4">已完成活动</div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-cryptocast-muted">
              <span>完成率</span>
              <span className="font-bold text-cryptocast-green-bright">
                {stats.totalCampaigns > 0 ? Math.round((stats.completedCampaigns / stats.totalCampaigns) * 100) : 0}%
              </span>
            </div>
            <div className="h-3 bg-cryptocast-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cryptocast-green to-cryptocast-green-bright rounded-full cryptocast-shimmer transition-all duration-1000"
                style={{width: `${stats.totalCampaigns > 0 ? (stats.completedCampaigns / stats.totalCampaigns) * 100 : 0}%`}}
              ></div>
            </div>
          </div>
        </div>

        <div className="card-cryptocast p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="glass px-3 py-1 rounded-full">
              <span className="text-sm font-medium text-cryptocast-cyan">地址</span>
            </div>
            <div className="text-5xl text-cryptocast-cyan opacity-60">👥</div>
          </div>
          <div className="text-5xl font-bold text-cryptocast-white mb-3 cryptocast-shimmer">{stats.totalRecipients.toLocaleString()}</div>
          <div className="text-base text-cryptocast-secondary font-medium mb-4">总收币地址数</div>
          <div className="glass p-3 rounded-xl">
            <div className="flex justify-between items-center text-sm">
              <span className="text-cryptocast-muted">已发送</span>
              <span className="font-bold text-cryptocast-cyan-bright">{stats.completedRecipients.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="card-cryptocast p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="glass px-3 py-1 rounded-full">
              <span className="text-sm font-medium text-cryptocast-purple">Gas</span>
            </div>
            <div className="text-5xl text-cryptocast-warning opacity-60">⚡</div>
          </div>
          <div className="text-5xl font-bold text-cryptocast-white mb-3 cryptocast-shimmer">{stats.totalGasUsed.toLocaleString()}</div>
          <div className="text-base text-cryptocast-secondary font-medium mb-4">累计 Gas 消耗</div>
          <div className="glass p-3 rounded-xl">
            <div className="text-center text-sm text-cryptocast-muted">
              <span className="font-semibold text-cryptocast-warning-light">单位: Gwei</span>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Main Content Area - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left Column: Active + Recent Campaigns */}
        <div className="lg:col-span-2 space-y-6">

          {/* Active Campaigns */}
          <div className="card-cryptocast p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-cryptocast-gradient flex items-center justify-center cryptocast-glow">
                  <span className="text-2xl">🚀</span>
                </div>
                <h2 className="text-2xl font-bold text-cryptocast-white">进行中的活动</h2>
              </div>
              <button
                onClick={() => navigate('/history')}
                className="glass px-4 py-2 rounded-xl text-cryptocast-purple hover:text-cryptocast-white hover:bg-cryptocast-purple/20 transition-cryptocast flex items-center gap-2 text-sm font-medium"
              >
                查看全部
                <span className="text-lg">→</span>
              </button>
            </div>

            {activeCampaigns.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-32 h-32 mx-auto mb-8 rounded-full glass flex items-center justify-center cryptocast-float">
                  <span className="text-6xl">📋</span>
                </div>
                <h3 className="text-2xl font-bold text-cryptocast-white mb-3">暂无进行中的活动</h3>
                <p className="text-cryptocast-secondary mb-8 text-lg">开始您的第一个空投活动</p>
                <button
                  onClick={() => navigate('/campaign/create')}
                  className="btn-cryptocast shadow-glow-purple text-lg px-8 py-4"
                >
                  <span className="text-2xl">➕</span>
                  创建第一个活动
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {activeCampaigns.map((campaign) => (
                  <div key={campaign.id} className="card-cryptocast p-6 hover:shadow-glow-cyan transition-all">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex-1">
                        <h3 className="font-bold text-2xl mb-4 text-cryptocast-white hover:text-cryptocast-cyan transition-colors">{campaign.name}</h3>
                        <div className="flex flex-wrap gap-3">
                          <div className="glass px-4 py-2 rounded-xl flex items-center gap-2">
                            <span className="text-lg">📍</span>
                            <span className="text-sm font-medium text-cryptocast-secondary">{getChainName(campaign.chain)}</span>
                          </div>
                          <div className="glass px-4 py-2 rounded-xl flex items-center gap-2">
                            <span className="text-lg">👥</span>
                            <span className="text-sm font-medium text-cryptocast-secondary">{campaign.totalRecipients.toLocaleString()} 地址</span>
                          </div>
                          <div className="glass px-4 py-2 rounded-xl flex items-center gap-2">
                            <span className="text-lg">📅</span>
                            <span className="text-sm font-medium text-cryptocast-secondary">{new Date(campaign.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-4">
                        <span className={`glass px-4 py-2 rounded-xl font-bold text-sm ${getStatusColor(campaign.status)}`}>
                          {getStatusText(campaign.status)}
                        </span>
                        <button
                          onClick={() => navigate(`/campaign/${campaign.id}`)}
                          className="btn-cryptocast text-sm px-6 py-3"
                        >
                          查看详情
                        </button>
                      </div>
                    </div>

                    {/* Enhanced Progress Bar */}
                    {campaign.totalRecipients > 0 && (
                      <div className="mt-6 glass p-5 rounded-2xl">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-sm font-bold text-cryptocast-secondary">发送进度</span>
                          <span className="text-sm font-bold text-cryptocast-cyan-bright">
                            {campaign.completedRecipients.toLocaleString()} / {campaign.totalRecipients.toLocaleString()}
                            <span className="text-xs ml-2 text-cryptocast-muted">
                              ({campaign.totalRecipients > 0 ? Math.round((campaign.completedRecipients / campaign.totalRecipients) * 100) : 0}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-4 bg-cryptocast-bg-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cryptocast-cyan to-cryptocast-cyan-bright rounded-full cryptocast-shimmer transition-all duration-1000"
                            style={{width: `${campaign.totalRecipients > 0 ? (campaign.completedRecipients / campaign.totalRecipients) * 100 : 0}%`}}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enhanced Recent Campaigns List */}
          <div className="card-cryptocast p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-cryptocast-gradient-accent flex items-center justify-center cryptocast-glow">
                  <span className="text-2xl">📋</span>
                </div>
                <h2 className="text-2xl font-bold text-cryptocast-white">最近活动</h2>
              </div>
              <button
                onClick={() => navigate('/history')}
                className="glass px-4 py-2 rounded-xl text-cryptocast-purple hover:text-cryptocast-white hover:bg-cryptocast-purple/20 transition-cryptocast flex items-center gap-2 text-sm font-medium"
              >
                查看全部
                <span className="text-lg">→</span>
              </button>
            </div>

            {campaigns.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full glass flex items-center justify-center cryptocast-float">
                  <span className="text-5xl">🔍</span>
                </div>
                <h3 className="text-xl font-bold text-cryptocast-white mb-2">暂无活动记录</h3>
                <p className="text-cryptocast-secondary">创建活动后将在此处显示</p>
              </div>
            ) : (
              <div className="space-y-4 scrollbar-cryptocast max-h-96 overflow-y-auto">
                {campaigns.slice(0, 5).map((campaign) => (
                  <div key={campaign.id} className="glass p-4 rounded-xl hover:bg-cryptocast-bg-card-hover transition-cryptocast">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="font-bold text-cryptocast-white mb-2">{campaign.name}</div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className={`glass px-3 py-1 rounded-lg text-xs font-medium ${getStatusColor(campaign.status)}`}>
                            {getStatusText(campaign.status)}
                          </span>
                          <span className="glass px-3 py-1 rounded-lg text-xs text-cryptocast-secondary">
                            {getChainName(campaign.chain)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right mb-2">
                          <div className="text-xs text-cryptocast-muted">进度</div>
                          <div className="text-sm font-bold text-cryptocast-cyan">
                            {campaign.completedRecipients}/{campaign.totalRecipients}
                          </div>
                        </div>
                        <div className="h-2 w-20 bg-cryptocast-bg-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cryptocast-gradient rounded-full cryptocast-shimmer"
                            style={{width: `${campaign.totalRecipients > 0 ? (campaign.completedRecipients / campaign.totalRecipients) * 100 : 0}%`}}
                          ></div>
                        </div>
                        <div className="text-xs text-cryptocast-muted">
                          {new Date(campaign.createdAt).toLocaleDateString()}
                        </div>
                        <button
                          onClick={() => navigate(`/campaign/${campaign.id}`)}
                          className="text-cryptocast-purple hover:text-cryptocast-cyan text-sm font-medium transition-colors"
                        >
                          详情 →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Right Sidebar: Quick Actions */}
        <div className="space-y-6">
          <div className="card-cryptocast p-6">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-cryptocast-gradient-accent flex items-center justify-center cryptocast-glow-cyan">
                <span className="text-2xl">⚡</span>
              </div>
              <h2 className="text-2xl font-bold text-cryptocast-white">快速操作</h2>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => navigate('/campaign/create')}
                className="btn-cryptocast w-full justify-start gap-4 h-auto py-5 hover:shadow-glow-purple group"
              >
                <div className="w-12 h-12 rounded-xl glass flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-2xl">➕</span>
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-cryptocast-white text-lg mb-1">创建新活动</div>
                  <div className="text-sm text-cryptocast-secondary">部署智能合约发起空投</div>
                </div>
              </button>

              <button
                onClick={() => navigate('/history')}
                className="glass w-full justify-start gap-4 h-auto py-5 hover:bg-cryptocast-bg-card-hover group transition-cryptocast border border-cryptocast-glass-border rounded-xl"
              >
                <div className="w-12 h-12 rounded-xl glass flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-2xl">📜</span>
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-cryptocast-white text-lg mb-1">查看历史</div>
                  <div className="text-sm text-cryptocast-secondary">浏览所有活动记录</div>
                </div>
              </button>

              <button
                onClick={() => navigate('/settings')}
                className="glass w-full justify-start gap-4 h-auto py-5 hover:bg-cryptocast-bg-card-hover group transition-cryptocast border border-cryptocast-glass-border rounded-xl"
              >
                <div className="w-12 h-12 rounded-xl glass flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-2xl">⚙️</span>
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-cryptocast-white text-lg mb-1">系统设置</div>
                  <div className="text-sm text-cryptocast-secondary">管理网络和钱包</div>
                </div>
              </button>
            </div>
          </div>

          {/* Enhanced Help and Resources */}
          <div className="card-cryptocast p-6 cryptocast-glow-cyan">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center cryptocast-float">
                <span className="text-2xl">💡</span>
              </div>
              <h3 className="font-bold text-xl text-cryptocast-white">需要帮助？</h3>
            </div>
            <p className="text-sm text-cryptocast-secondary mb-6 leading-relaxed">
              查看使用指南，了解如何高效管理您的加密货币空投活动。
            </p>
            <div className="space-y-3">
              <a href="#" className="glass w-full justify-start gap-3 px-4 py-3 rounded-xl hover:bg-cryptocast-bg-card-hover transition-cryptocast flex items-center text-cryptocast-white group">
                <span className="text-lg group-hover:scale-110 transition-transform">📖</span>
                <span className="font-medium">使用文档</span>
              </a>
              <a href="#" className="glass w-full justify-start gap-3 px-4 py-3 rounded-xl hover:bg-cryptocast-bg-card-hover transition-cryptocast flex items-center text-cryptocast-white group">
                <span className="text-lg group-hover:scale-110 transition-transform">🎥</span>
                <span className="font-medium">视频教程</span>
              </a>
              <a href="#" className="glass w-full justify-start gap-3 px-4 py-3 rounded-xl hover:bg-cryptocast-bg-card-hover transition-cryptocast flex items-center text-cryptocast-white group">
                <span className="text-lg group-hover:scale-110 transition-transform">💬</span>
                <span className="font-medium">联系支持</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
