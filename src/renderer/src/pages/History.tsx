import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaign } from '../contexts/CampaignContext';
import { Campaign, CampaignStatus } from '../types';

interface HistoryFilters {
  timeRange: 'all' | 'today' | 'week' | 'month' | 'custom';
  chain: string;
  status: CampaignStatus;
  search: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

interface ChainInfo {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  color: string;
}

export default function History() {
  const navigate = useNavigate();
  const { state, actions } = useCampaign();
  const [filters, setFilters] = useState<HistoryFilters>({
    timeRange: 'all',
    chain: 'all',
    status: 'all',
    search: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load campaigns on mount and set up auto-refresh
  useEffect(() => {
    loadData();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      loadData(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async (silent = false) => {
    if (!silent) {
      setIsRefreshing(true);
    }
    try {
      await actions.loadCampaigns();
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      if (!silent) {
        setIsRefreshing(false);
      }
    }
  };

  const chains: Record<string, ChainInfo> = {
    ethereum: { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', icon: '🔷', color: '#627eea' },
    polygon: { id: 'polygon', name: 'Polygon', symbol: 'MATIC', icon: '🟣', color: '#8247e5' },
    arbitrum: { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', icon: '🔵', color: '#28a0f0' },
    bsc: { id: 'bsc', name: 'BSC', symbol: 'BNB', icon: '🟡', color: '#f3ba2f' },
    optimism: { id: 'optimism', name: 'Optimism', symbol: 'ETH', icon: '🔴', color: '#ff0420' },
  };

  // Use real data from state
  const displayCampaigns = state.campaigns;

  const filteredCampaigns = useMemo(() => {
    let filtered = [...displayCampaigns];

    // Time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (filters.timeRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter(campaign => {
        const campaignDate = new Date(campaign.createdAt);
        return campaignDate >= startDate;
      });
    }

    // Custom date range filter
    if (filters.dateRange) {
      const { start, end } = filters.dateRange;
      filtered = filtered.filter(campaign => {
        const campaignDate = new Date(campaign.createdAt);
        return campaignDate >= new Date(start) && campaignDate <= new Date(end);
      });
    }

    // Chain filter
    if (filters.chain !== 'all') {
      filtered = filtered.filter(campaign => campaign.chain === filters.chain);
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(campaign => campaign.status === filters.status);
    }

    // Search filter
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(campaign =>
        campaign.name.toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  }, [state.campaigns, filters]);

  const paginatedCampaigns = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return filteredCampaigns.slice(startIndex, endIndex);
  }, [filteredCampaigns, pagination]);

  const totalPages = Math.ceil(filteredCampaigns.length / pagination.limit);

  const getStatusBadge = (status: CampaignStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <div className="badge badge-success gap-1">✅ 已完成</div>;
      case 'FAILED':
        return <div className="badge badge-error gap-1">❌ 已失败</div>;
      case 'SENDING':
        return <div className="badge badge-info gap-1">🔄 发送中</div>;
      case 'PAUSED':
        return <div className="badge badge-warning gap-1">⏸️ 暂停</div>;
      case 'CANCELLED':
        return <div className="badge badge-neutral gap-1">❌ 已取消</div>;
      case 'READY':
        return <div className="badge badge-warning gap-1">⚡ 就绪</div>;
      case 'FUNDED':
        return <div className="badge badge-info gap-1">💰 已充值</div>;
      default:
        return <div className="badge badge-neutral gap-1">📝 已创建</div>;
    }
  };

  const getChainBadge = (chainId: string) => {
    const chain = chains[chainId];
    if (!chain) return <div className="badge badge-outline badge-sm">Unknown</div>;
    return (
      <div className="badge badge-outline badge-sm gap-1">
        <span>{chain.icon}</span>
        <span>{chain.name}</span>
      </div>
    );
  };

  const handleExportSingle = async (campaign: Campaign) => {
    try {
      const result = await actions.exportReport(campaign.id);
      if (result.success) {
        alert(`活动 "${campaign.name}" 报告导出成功！`);
      } else {
        alert('导出失败，请重试');
      }
    } catch (error) {
      alert(`导出活动 "${campaign.name}" 失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('zh-CN');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const formatAmount = (amount: string, decimals = 4) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    return num.toFixed(decimals);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📜</span>
          <h1 className="text-2xl font-bold">历史记录</h1>
          {state.isLoading && (
            <span className="loading loading-spinner loading-sm"></span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadData()}
            disabled={isRefreshing}
            className="btn btn-sm btn-ghost"
          >
            {isRefreshing ? (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                刷新中...
              </>
            ) : (
              <>🔄 刷新</>
            )}
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn btn-sm btn-ghost"
          >
            ← 返回仪表盘
          </button>
        </div>
      </div>

      {/* Statistical Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-primary">
            📋
          </div>
          <div className="stat-title">历史总活动</div>
          <div className="stat-value text-primary">{displayCampaigns.length}</div>
          <div className="stat-desc text-info">累计创建</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-secondary">
            👥
          </div>
          <div className="stat-title">总发送地址</div>
          <div className="stat-value text-secondary">
            {displayCampaigns.reduce((sum, c) => sum + c.totalRecipients, 0).toLocaleString()}
          </div>
          <div className="stat-desc text-secondary">所有活动</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-success">
            ✅
          </div>
          <div className="stat-title">平均成功率</div>
          <div className="stat-value text-success">98.5%</div>
          <div className="stat-desc">
            <div className="flex items-center gap-2">
              <progress className="progress progress-success w-20" value="98.5" max="100"></progress>
              <span className="text-xs text-success">优秀</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow-sm mb-6">
        <div className="card-body">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🔍</span>
            <h2 className="text-lg font-semibold">筛选条件</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Time Range Filter */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">时间范围</span>
              </label>
              <select
                value={filters.timeRange}
                onChange={(e) => setFilters({ ...filters, timeRange: e.target.value as any })}
                className="select select-bordered"
              >
                <option value="all">全部时间</option>
                <option value="today">今天</option>
                <option value="week">本周</option>
                <option value="month">本月</option>
                <option value="custom">自定义</option>
              </select>
            </div>

            {/* Chain Filter */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">区块链</span>
              </label>
              <select
                value={filters.chain}
                onChange={(e) => setFilters({ ...filters, chain: e.target.value })}
                className="select select-bordered"
              >
                <option value="all">所有链</option>
                {Object.values(chains).map(chain => (
                  <option key={chain.id} value={chain.id}>
                    {chain.icon} {chain.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">状态</span>
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
                className="select select-bordered"
              >
                <option value="all">全部状态</option>
                <option value="COMPLETED">✅ 已完成</option>
                <option value="FAILED">❌ 已失败</option>
                <option value="SENDING">🔄 发送中</option>
                <option value="PAUSED">⏸️ 已暂停</option>
              </select>
            </div>

            {/* Search */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">搜索</span>
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="输入活动名称..."
                className="input input-bordered"
              />
            </div>
          </div>

        {/* Custom Date Range */}
        {filters.timeRange === 'custom' && (
          <div className="collapse collapse-arrow bg-base-200 mt-4">
            <input type="checkbox" defaultChecked />
            <div className="collapse-title text-sm font-medium">
              自定义日期范围
            </div>
            <div className="collapse-content">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">开始日期</span>
                  </label>
                  <input
                    type="date"
                    value={filters.dateRange?.start || ''}
                    onChange={(e) => setFilters({
                      ...filters,
                      dateRange: { ...filters.dateRange!, start: e.target.value }
                    })}
                    className="input input-bordered"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">结束日期</span>
                  </label>
                  <input
                    type="date"
                    value={filters.dateRange?.end || ''}
                    min={filters.dateRange?.start}
                    onChange={(e) => setFilters({
                      ...filters,
                      dateRange: { ...filters.dateRange!, end: e.target.value }
                    })}
                    className="input input-bordered"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-base-content/60">
          显示 <span className="font-medium">{formatNumber(paginatedCampaigns.length)}</span> /{' '}
          <span className="font-medium">{formatNumber(filteredCampaigns.length)}</span> 条记录
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm">📥 导出全部</button>
          <button className="btn btn-ghost btn-sm">🔄 刷新</button>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="card bg-base-100 shadow-sm">
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th className="bg-base-200">名称</th>
                <th className="bg-base-200">链</th>
                <th className="bg-base-200">状态</th>
                <th className="bg-base-200 text-right">地址数</th>
                <th className="bg-base-200 text-right">成功率</th>
                <th className="bg-base-200 text-right">Gas消耗</th>
                <th className="bg-base-200">创建时间</th>
                <th className="bg-base-200 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="text-6xl mb-4">📭</div>
                    <div className="text-lg font-medium mb-2">暂无活动记录</div>
                    <div className="text-sm text-base-content/60">创建活动后将在此处显示</div>
                  </td>
                </tr>
              ) : (
                paginatedCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover">
                    <td>
                      <div>
                        <div className="font-medium">{campaign.name}</div>
                        <div className="text-sm text-base-content/60 truncate max-w-[200px]">
                          {campaign.description}
                        </div>
                      </div>
                    </td>
                    <td>
                      {getChainBadge(campaign.chain)}
                    </td>
                    <td>
                      {getStatusBadge(campaign.status)}
                    </td>
                    <td className="text-right">
                      <div className="font-medium">{formatNumber(campaign.totalRecipients)}</div>
                      <div className="text-xs text-success">
                        +{formatNumber(campaign.successfulRecipients)} 成功
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="text-sm font-medium">
                          {campaign.totalRecipients > 0
                            ? ((campaign.successfulRecipients / campaign.totalRecipients) * 100).toFixed(1)
                            : '0'
                          }%
                        </div>
                        <progress
                          className="progress progress-success w-8 h-2"
                          value={campaign.totalRecipients > 0 ? (campaign.successfulRecipients / campaign.totalRecipients) * 100 : 0}
                          max="100"
                        ></progress>
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="text-sm">
                        <div className="font-mono">{formatAmount(campaign.gasUsed)} ETH</div>
                        <div className="text-xs text-base-content/60">
                          ≈ ${(parseFloat(campaign.gasUsed || '0') * 2000).toFixed(0)}
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-base-content/60">
                      {formatDate(campaign.createdAt)}
                    </td>
                    <td>
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => navigate(`/campaign/${campaign.id}`)}
                          className="btn btn-ghost btn-xs"
                        >
                          👁️ 详情
                        </button>
                        <button
                          onClick={() => handleExportSingle(campaign)}
                          className="btn btn-ghost btn-xs"
                        >
                          📥 导出
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-6">
          <div className="join">
            <button
              onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
              disabled={pagination.page === 1}
              className="join-item btn btn-sm"
            >
              «
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNumber = Math.max(1, Math.min(totalPages - 4, pagination.page - 2)) + i;
              return (
                <button
                  key={pageNumber}
                  onClick={() => setPagination({ ...pagination, page: pageNumber })}
                  className={`join-item btn btn-sm ${pagination.page === pageNumber ? 'btn-active' : ''}`}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              onClick={() => setPagination({ ...pagination, page: Math.min(totalPages, pagination.page + 1) })}
              disabled={pagination.page === totalPages}
              className="join-item btn btn-sm"
            >
              »
            </button>
          </div>

          <div className="ml-4 text-sm text-base-content/60">
            第 {pagination.page} 页，共 {totalPages} 页
          </div>
        </div>
      )}
    </div>
  );
}