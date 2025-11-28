import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActivityWallet,
  WalletBalance,
  EVMChain,
  ChainInfo
} from '../types';
import { isSolanaChain, exportPrivateKey, getChainDisplayName, getChainDisplayBadge } from '../utils/chainTypeUtils';

export default function WalletManagement() {
  const navigate = useNavigate();
  const [wallets, setWallets] = useState<ActivityWallet[]>([]);
  const [totalWallets, setTotalWallets] = useState(0);
  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [showPrivateKeyModal, setShowPrivateKeyModal] = useState(false);
  const [exportedWallet, setExportedWallet] = useState<{ address: string; privateKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadWallets();
    loadChains();
  }, [currentPage]); // Reload when page changes

  const loadWallets = async () => {
    setLoading(true);
    try {
      // Load real wallet data from backend
      if (window.electronAPI?.wallet) {
        const response = await window.electronAPI.wallet.list({
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        });
        
        // Handle both old array format (for backward compatibility) and new object format
        if (Array.isArray(response)) {
           setWallets(response);
           setTotalWallets(response.length); // Fallback if no total returned
        } else {
           setWallets(response.wallets);
           setTotalWallets(response.total);
        }
      }
    } catch (error) {
      console.error('Failed to load wallets:', error);
      // Fallback to empty array
      setWallets([]);
      setTotalWallets(0);
    } finally {
      setLoading(false);
    }
  };

  const loadChains = async () => {
    try {
      if (window.electronAPI?.chain) {
        const chainsData = await window.electronAPI.chain.getAllChains();
        setChains(chainsData);
      }
    } catch (error) {
      console.error('Failed to load chains:', error);
    }
  };


  // 计算分页数据
  const totalPages = Math.ceil(totalWallets / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalWallets);
  // Data is already paginated from backend, so we display all loaded wallets
  const displayWallets = wallets;

  
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
      // 使用统一的私钥导出函数
      const privateKeyDisplay = await exportPrivateKey(wallet.privateKeyBase64 || '', wallet as any);

      // 显示自定义私钥弹窗
      setExportedWallet({
        address: wallet.address,
        privateKey: privateKeyDisplay
      });
      setShowPrivateKeyModal(true);
      setCopied(false);
    } catch (error) {
      console.error('Failed to export wallet:', error);
      alert('获取私钥失败，请重试');
    }
  };

  const handleCopyPrivateKey = () => {
    if (exportedWallet?.privateKey) {
      navigator.clipboard.writeText(exportedWallet.privateKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyAddress = () => {
    if (exportedWallet?.address) {
      navigator.clipboard.writeText(exportedWallet.address);
    }
  };

  const handleCloseModal = () => {
    setShowPrivateKeyModal(false);
    setExportedWallet(null);
    setCopied(false);
  };

  const getStatusBadge = (status: string) => {
    const upperStatus = status.toUpperCase();
    switch (upperStatus) {
      case 'CREATED':
        return <div className="badge badge-warning gap-1">📝 已创建</div>;
      case 'FUNDED':
        return <div className="badge badge-info gap-1">💰 已充值</div>;
      case 'READY':
        return <div className="badge badge-primary gap-1">✅ 准备就绪</div>;
      case 'SENDING':
        return <div className="badge badge-info gap-1">🔄 发送中</div>;
      case 'PAUSED':
        return <div className="badge badge-warning gap-1">⏸️ 已暂停</div>;
      case 'COMPLETED':
        return <div className="badge badge-success gap-1">✅ 已完成</div>;
      case 'FAILED':
        return <div className="badge badge-error gap-1">❌ 已失败</div>;
      // Fallback for lowercase values
      case 'ACTIVE':
        return <div className="badge badge-info gap-1">🔄 进行中</div>;
      case 'PENDING':
        return <div className="badge badge-warning gap-1">⏳ 待充值</div>;
      default:
        return <div className="badge badge-neutral gap-1">📋 {status}</div>;
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

  const getChainName = (chainValue: string) => {
    // 使用统一的链显示工具，直接传递 chainValue
    return getChainDisplayName(chainValue, chains);
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
          <div className="stat-value text-primary">{totalWallets}</div>
          <div className="stat-desc text-info">所有活动钱包</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-success">
            ✅
          </div>
          <div className="stat-title">活跃钱包</div>
          <div className="stat-value text-success">
            {wallets.filter(w => {
              const status = w.status.toUpperCase();
              return status === 'SENDING' || status === 'FUNDED' || status === 'READY' || status === 'ACTIVE';
            }).length}
          </div>
          <div className="stat-desc text-success">当前页进行中</div>
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
                <th className="bg-base-200">区块链网络</th>
                <th className="bg-base-200 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {displayWallets.map((wallet) => (
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
                    <div className="flex items-center gap-2">
                      <div className="badge badge-primary badge-sm">
                        {getChainName(wallet.chain)}
                      </div>
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
            显示 {startIndex + 1}-{endIndex} / 共 {totalWallets} 个钱包
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

      {/* Private Key Export Modal */}
      {showPrivateKeyModal && exportedWallet && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span>🔑</span>
              <span>导出私钥</span>
            </h3>

            {/* Warning Alert */}
            <div className="alert alert-warning mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm">
                <strong>安全警告：</strong>私钥拥有您钱包的完全控制权，请妥善保管，切勿分享给他人！
              </span>
            </div>

            {/* Wallet Address */}
            <div className="mb-4">
              <label className="label">
                <span className="label-text font-semibold">钱包地址</span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1 bg-base-200 px-4 py-3 rounded-lg font-mono text-sm break-all">
                  {exportedWallet.address}
                </div>
                <button
                  onClick={handleCopyAddress}
                  className="btn btn-square btn-outline"
                  title="复制地址"
                >
                  📋
                </button>
              </div>
            </div>

            {/* Private Key */}
            <div className="mb-6">
              <label className="label">
                <span className="label-text font-semibold">私钥 (Private Key)</span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1 bg-error/10 border-2 border-error/30 px-4 py-3 rounded-lg font-mono text-sm break-all">
                  {exportedWallet.privateKey}
                </div>
                <button
                  onClick={handleCopyPrivateKey}
                  className={`btn btn-square ${copied ? 'btn-success' : 'btn-error'}`}
                  title="复制私钥"
                >
                  {copied ? '✓' : '📋'}
                </button>
              </div>
              {copied && (
                <div className="text-success text-sm mt-2 flex items-center gap-1">
                  <span>✓</span>
                  <span>私钥已复制到剪贴板</span>
                </div>
              )}
            </div>

            {/* Security Tips */}
            <div className="bg-base-200 p-4 rounded-lg mb-4">
              <h4 className="font-semibold mb-2 text-sm">安全提示</h4>
              <ul className="text-sm space-y-1 text-base-content/80">
                <li>• EVM私钥可以导入到 MetaMask、Trust Wallet 等钱包</li>
                <li>• Solana私钥为64字节数组格式，可导入到 Phantom、Solflare 等钱包</li>
                <li>• 格式示例：[135,23,98,189,91,220,102,232,69,78,173,75,129,198,30,190,...]</li>
                <li>• 请将私钥保存在安全的地方（如密码管理器）</li>
                <li>• 不要截图或通过互联网传输私钥</li>
                <li>• 任何拥有私钥的人都可以控制钱包资金</li>
              </ul>
            </div>

            {/* Modal Actions */}
            <div className="modal-action">
              <button onClick={handleCloseModal} className="btn btn-primary">
                我已安全保存
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={handleCloseModal}></div>
        </div>
      )}
    </div>
  );
}