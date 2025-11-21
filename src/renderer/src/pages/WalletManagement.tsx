import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActivityWallet,
  WalletBalance
} from '../types';

export default function WalletManagement() {
  const navigate = useNavigate();
  const [wallets, setWallets] = useState<ActivityWallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  useEffect(() => {
    loadWallets();
  }, []);

  const loadWallets = async () => {
    setLoading(true);
    try {
      // Load real wallet data from backend
      if (window.electronAPI?.wallet) {
        const walletsData = await window.electronAPI.wallet.list({
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        });
        setWallets(walletsData);
      }
    } catch (error) {
      console.error('Failed to load wallets:', error);
      // Fallback to empty array
      setWallets([]);
    } finally {
      setLoading(false);
    }
  };

  const loadWalletsOld = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration - DEPRECATED
      const mockWallets: ActivityWallet[] = [
        {
          id: '1',
          campaignId: 'campaign-1',
          campaignName: '2025-01 营销活动',
          address: '0x1234567890123456789012345678901234567890',
          balances: [
            {
              tokenAddress: '0x0000000000000000000000000000000000000000',
              tokenSymbol: 'WETH',
              tokenDecimals: 18,
              balance: '450.5',
              usdValue: '900000'
            },
            {
              tokenAddress: '0x0000000000000000000000000000000000000001',
              tokenSymbol: 'MATIC',
              tokenDecimals: 18,
              balance: '10000',
              usdValue: '8000'
            },
            {
              tokenAddress: '0x0000000000000000000000000000000000000002',
              tokenSymbol: 'USDC',
              tokenDecimals: 6,
              balance: '0',
            },
            {
              tokenAddress: '0x0000000000000000000000000000000000000003',
              tokenSymbol: 'ETH',
              tokenDecimals: 18,
              balance: '0',
            }
          ],
          status: 'active',
          totalBalance: '450.5',
          totalCapacity: '500',
          createdAt: '2025-01-15T10:00:00Z',
          updatedAt: '2025-01-20T15:30:00Z',
          lastBalanceUpdate: '2025-01-20T15:30:00Z'
        },
        {
          id: '2',
          campaignId: 'campaign-2',
          campaignName: '2024-12 新年奖励',
          address: '0x2345678901234567890123456789012345678901',
          balances: [
            {
              tokenAddress: '0x0000000000000000000000000000000000000001',
              tokenSymbol: 'MATIC',
              tokenDecimals: 18,
              balance: '5000',
              usdValue: '4000'
            },
            {
              tokenAddress: '0x0000000000000000000000000000000000000002',
              tokenSymbol: 'USDC',
              tokenDecimals: 6,
              balance: '25000',
              usdValue: '25000'
            }
          ],
          status: 'pending',
          totalBalance: '29000',
          totalCapacity: '50000',
          createdAt: '2024-12-20T09:00:00Z',
          updatedAt: '2025-01-19T12:00:00Z',
          lastBalanceUpdate: '2025-01-19T12:00:00Z'
        },
        {
          id: '3',
          campaignId: 'campaign-3',
          campaignName: '2024-11 社区空投',
          address: '0x3456789012345678901234567890123456789012',
          balances: [
            {
              tokenAddress: '0x0000000000000000000000000000000000000000',
              tokenSymbol: 'WETH',
              tokenDecimals: 18,
              balance: '0',
            },
            {
              tokenAddress: '0x0000000000000000000000000000000000000003',
              tokenSymbol: 'ETH',
              tokenDecimals: 18,
              balance: '0',
            }
          ],
          status: 'completed',
          totalBalance: '0',
          totalCapacity: '200',
          createdAt: '2024-11-10T14:00:00Z',
          updatedAt: '2024-11-25T18:00:00Z',
          lastBalanceUpdate: '2024-11-25T18:00:00Z'
        },
        {
          id: '4',
          campaignId: 'campaign-4',
          campaignName: '2024-10 测试活动',
          address: '0x4567890123456789012345678901234567890123',
          balances: [
            {
              tokenAddress: '0x0000000000000000000000000000000000000000',
              tokenSymbol: 'WETH',
              tokenDecimals: 18,
              balance: '25',
              usdValue: '50000'
            }
          ],
          status: 'failed',
          totalBalance: '25',
          totalCapacity: '100',
          createdAt: '2024-10-05T11:00:00Z',
          updatedAt: '2024-10-08T16:00:00Z',
          lastBalanceUpdate: '2024-10-08T16:00:00Z'
        },
        {
          id: '5',
          campaignId: 'campaign-5',
          campaignName: '2024-09 Beta测试',
          address: '0x5678901234567890123456789012345678901234',
          balances: [
            {
              tokenAddress: '0x0000000000000000000000000000000000000001',
              tokenSymbol: 'MATIC',
              tokenDecimals: 18,
              balance: '500',
              usdValue: '400'
            },
            {
              tokenAddress: '0x0000000000000000000000000000000000000002',
              tokenSymbol: 'USDC',
              tokenDecimals: 6,
              balance: '1000',
              usdValue: '1000'
            }
          ],
          status: 'completed',
          totalBalance: '1500',
          totalCapacity: '1500',
          createdAt: '2024-09-15T13:00:00Z',
          updatedAt: '2024-09-28T10:00:00Z',
          lastBalanceUpdate: '2024-09-28T10:00:00Z'
        }
      ];

      setWallets(mockWallets);
    } catch (error) {
      console.error('Failed to load wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  // 计算分页数据
  const totalPages = Math.ceil(wallets.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedWallets = wallets.slice(startIndex, endIndex);

  const handleRefreshBalances = async () => {
    setLoading(true);
    try {
      // 只刷新当前页的钱包余额
      await loadWallets();
      alert('当前页余额刷新成功！');
    } catch (error) {
      console.error('Failed to refresh balances:', error);
      alert('刷新余额失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (wallet: ActivityWallet) => {
    // 直接跳转到对应的活动详情页面
    navigate(`/campaign/${wallet.campaignId}`);
  };

  const handleExportWallet = async (wallet: ActivityWallet) => {
    if (!wallet.privateKeyBase64) {
      alert('该钱包没有可导出的私钥');
      return;
    }

    try {
      if (window.electronAPI?.wallet) {
        const privateKey = await window.electronAPI.wallet.exportPrivateKey(wallet.privateKeyBase64);

        // 直接显示私钥弹窗
        alert(`钱包地址: ${wallet.address}\n私钥: ${privateKey}\n\n请妥善保管此私钥！`);
      }
    } catch (error) {
      console.error('Failed to export wallet:', error);
      alert('获取私钥失败，请重试');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <div className="badge badge-info gap-1">🔄 进行中</div>;
      case 'pending':
        return <div className="badge badge-warning gap-1">⏳ 待充值</div>;
      case 'completed':
        return <div className="badge badge-success gap-1">✅ 已完成</div>;
      case 'failed':
        return <div className="badge badge-error gap-1">❌ 已失败</div>;
      default:
        return <div className="badge badge-neutral gap-1">📋 未知</div>;
    }
  };

  const formatNumber = (num: string, decimals = 2) => {
    const number = parseFloat(num);
    if (isNaN(number)) return '0';
    return number.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl">👛</span>
          <h1 className="text-2xl font-bold">钱包管理</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshBalances}
            disabled={loading}
            className="btn btn-ghost"
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                刷新中...
              </>
            ) : (
              '🔄 刷新余额'
            )}
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn btn-ghost"
          >
            ← 返回仪表盘
          </button>
        </div>
      </div>

      {/* Activity Wallet Management Explanation */}
      <div className="alert alert-info mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <h3 className="font-bold">活动钱包管理说明</h3>
          <div className="text-sm">
            系统为每个活动创建独立的钱包，确保隐私和安全性。使用外部钱包（如 MetaMask）为活动钱包充值。活动完成后，可以手动导出私钥以恢复剩余资金。
          </div>
        </div>
      </div>

      {/* Wallet Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-primary">
            👛
          </div>
          <div className="stat-title">活动钱包总数</div>
          <div className="stat-value text-primary">{wallets.length}</div>
          <div className="stat-desc text-info">当前页钱包</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-success">
            ✅
          </div>
          <div className="stat-title">活跃钱包</div>
          <div className="stat-value text-success">
            {wallets.filter(w => w.status === 'active').length}
          </div>
          <div className="stat-desc text-success">正在进行中</div>
        </div>
      </div>

      {/* Activity Wallet List */}
      <div className="card bg-base-100 shadow-sm">
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th className="bg-base-200">活动名称</th>
                <th className="bg-base-200">钱包地址</th>
                <th className="bg-base-200">余额状态</th>
                <th className="bg-base-200 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedWallets.map((wallet) => (
                <tr key={wallet.id} className="hover">
                  <td>
                    <div>
                      <div className="font-medium">{wallet.campaignName}</div>
                      <div className="text-sm text-base-content/60">{getStatusBadge(wallet.status)}</div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="bg-base-200 px-2 py-1 rounded text-xs font-mono break-all max-w-xs">
                        {wallet.address}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(wallet.address);
                          // 使用 toast 替代 alert
                        }}
                        className="btn btn-ghost btn-xs"
                        title="复制地址"
                      >
                        📋
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="space-y-1">
                      {wallet.balances.filter(b => parseFloat(b.balance) > 0).map((balance, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="badge badge-outline badge-sm">{balance.tokenSymbol}</div>
                          <div className="text-sm font-medium">{formatNumber(balance.balance, 4)}</div>
                        </div>
                      ))}
                      {wallet.balances.every(b => parseFloat(b.balance) === 0) && (
                        <div className="flex items-center gap-2 text-base-content/40">
                          <span>💰</span>
                          <span className="text-sm">余额已清空</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() => handleViewDetails(wallet)}
                        className="btn btn-ghost btn-xs"
                      >
                        👁️ 详情
                      </button>
                      <button
                        onClick={() => handleExportWallet(wallet)}
                        className="btn btn-ghost btn-xs"
                      >
                        🔑 导出
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-6">
          <div className="join">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="join-item btn btn-sm"
            >
              «
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`join-item btn btn-sm ${currentPage === pageNumber ? 'btn-active' : ''}`}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="join-item btn btn-sm"
            >
              »
            </button>
          </div>

          <div className="ml-4 text-sm text-base-content/60">
            显示 {startIndex + 1}-{Math.min(endIndex, wallets.length)} / 共 {wallets.length} 个钱包
          </div>
        </div>
      )}

      {/* Security Tips */}
      <div className="alert alert-warning mt-8">
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div>
          <h3 className="font-bold">安全提示</h3>
          <div className="text-sm">
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>每个活动使用独立钱包，防止地址关联分析</li>
              <li>私钥以加密格式存储在本地数据库中</li>
              <li>活动结束后建议及时回收剩余资金</li>
              <li>不要在公共电脑上使用本应用</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}