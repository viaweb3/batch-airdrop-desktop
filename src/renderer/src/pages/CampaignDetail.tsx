import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EVMChain } from '../types';

interface Campaign {
  id: string;
  name: string;
  chain: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  status: 'CREATED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  totalRecipients: number;
  completedRecipients: number;
  failedRecipients: number;
  walletAddress?: string;
  contractAddress?: string;
  createdAt: string;
  updatedAt: string;
  walletPrivateKeyBase64?: string;
}

interface TransactionRecord {
  id: string;
  batchNumber: number;
  status: 'success' | 'sending' | 'pending' | 'failed';
  addressCount: number;
  txHash?: string;
  gasUsed?: string;
  error?: string;
  createdAt: string;
}

interface Recipient {
  address: string;
  amount: string;
  status: 'success' | 'sending' | 'pending' | 'failed';
  txHash?: string;
  error?: string;
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [chains, setChains] = useState<EVMChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Pagination states
  const [txCurrentPage, setTxCurrentPage] = useState(1);
  const [recipientsCurrentPage, setRecipientsCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [walletBalances, setWalletBalances] = useState({
    native: { current: '0', total: '0' },
    token: { current: '0', total: '0' }
  });
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [showPrivateKeyModal, setShowPrivateKeyModal] = useState(false);
  const [exportedWallet, setExportedWallet] = useState<{ address: string; privateKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      loadCampaign();
      loadChains();
    }
  }, [id]);

  // Load chains from database
  const loadChains = async () => {
    try {
      if (window.electronAPI?.chain) {
        const chainsData = await window.electronAPI.chain.getEVMChains();
        setChains(chainsData);
      }
    } catch (error) {
      console.error('Failed to load chains:', error);
    }
  };

  const loadCampaign = async () => {
    setLoading(true);
    try {
      if (!id || id === 'undefined') {
        throw new Error('Campaign ID is required');
      }

      // Load campaign details from backend
      if (window.electronAPI?.campaign) {
        const details = await window.electronAPI.campaign.getDetails(id);

        if (!details) {
          throw new Error('Campaign not found');
        }

        // Set campaign data
        setCampaign({
          ...details.campaign,
          chainId: parseInt(details.campaign.chain),
        });

        // Load transactions
        try {
          const txData = await window.electronAPI.campaign.getTransactions(id, {
            limit: 100,
          });
          if (txData && Array.isArray(txData)) {
            setTransactions(txData.map((tx: any) => ({
              id: tx.id.toString(),
              batchNumber: tx.id,
              status: tx.status === 'CONFIRMED' ? 'success' : tx.status === 'PENDING' ? 'sending' : 'failed',
              addressCount: 1,
              txHash: tx.txHash,
              gasUsed: tx.gasUsed?.toString(),
              createdAt: tx.createdAt,
            })));
          }
        } catch (txError) {
          console.error('Failed to load transactions:', txError);
          console.error('Transaction error details:', {
            campaignId: id,
            error: txError instanceof Error ? txError.message : txError,
            stack: txError instanceof Error ? txError.stack : undefined
          });
          // Continue loading other data even if transactions fail
        }

        // Load recipients
        try {
          const recipientsData = await window.electronAPI.campaign.getRecipients(id);
          if (recipientsData && Array.isArray(recipientsData)) {
            setRecipients(recipientsData.map((r: any) => ({
              address: r.address,
              amount: r.amount,
              status: r.status === 'SENT' ? 'success' : r.status === 'PENDING' ? 'pending' : r.status === 'FAILED' ? 'failed' : 'sending',
              txHash: r.txHash,
              error: r.errorMessage,
            })));
          }
        } catch (recipientsError) {
          console.error('Failed to load recipients:', recipientsError);
          // Continue even if recipients fail to load
        }
      }
    } catch (error) {
      console.error('Failed to load campaign:', error);
      alert('加载活动详情失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <div className="badge badge-success gap-1">✅ 成功</div>;
      case 'SENDING':
        return <div className="badge badge-info gap-1">🔄 发送中</div>;
      case 'PAUSED':
        return <div className="badge badge-warning gap-1">⏸️ 暂停</div>;
      case 'FAILED':
        return <div className="badge badge-error gap-1">❌ 失败</div>;
      default:
        return <div className="badge badge-neutral gap-1">📋 创建</div>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'SENDING': return 'bg-blue-100 text-blue-800';
      case 'PAUSED': return 'bg-orange-100 text-orange-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePauseResume = async () => {
    if (!campaign || !id) return;

    try {
      if (window.electronAPI?.campaign) {
        if (campaign.status === 'SENDING') {
          // Pause campaign
          await window.electronAPI.campaign.pause(id);
          alert('活动已暂停');
          await loadCampaign(); // Reload to get updated status
        } else if (campaign.status === 'PAUSED') {
          // Resume campaign
          await window.electronAPI.campaign.resume(id);
          alert('活动已恢复');
          await loadCampaign(); // Reload to get updated status
        }
      }
    } catch (error) {
      console.error('Failed to pause/resume campaign:', error);
      alert('操作失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  const handleDeployContract = async () => {
    if (!campaign || !id) return;

    const confirmed = confirm('确定要为此活动部署合约吗？此操作将消耗一定的gas费用。');
    if (!confirmed) return;

    try {
      if (window.electronAPI?.campaign) {
        const result = await window.electronAPI.campaign.deployContract(id);
        alert(`合约部署成功！合约地址: ${result.contractAddress}`);
        await loadCampaign(); // Reload to get updated status
      }
    } catch (error) {
      console.error('Failed to deploy contract:', error);
      const errorMessage = getSolanaSpecificErrorMessage(error);
      alert('合约部署失败: ' + errorMessage);
    }
  };

  const handleRetryFailedTransactions = async () => {
    if (!campaign || !id) return;

    const confirmed = confirm('确定要重试所有失败的交易吗？这将重置失败交易的错误状态，然后可以恢复发送。');
    if (!confirmed) return;

    try {
      if (window.electronAPI?.campaign) {
        const result = await window.electronAPI.campaign.retryFailedTransactions(id);
        alert(result.message || '重试设置成功');
        await loadCampaign(); // Reload to get updated status
        await loadRecipients(); // Reload recipients to reflect the changes
      }
    } catch (error) {
      console.error('Failed to retry failed transactions:', error);
      const errorMessage = getSolanaSpecificErrorMessage(error);
      alert('重试失败: ' + errorMessage);
    }
  };

  const isSolanaChain = (chain: string | undefined): boolean => {
    return chain?.toLowerCase().includes('solana') || false;
  };

  const getSolanaSpecificErrorMessage = (error: any): string => {
    const errorMessage = error?.message || error?.toString() || '';

    if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient lamports')) {
      return 'SOL余额不足，请确保钱包有足够的SOL支付网络费用';
    }
    if (errorMessage.includes('Invalid account') || errorMessage.includes('not found')) {
      return '代币账户不存在或无效，请检查代币地址';
    }
    if (errorMessage.includes('Token account not found')) {
      return 'SPL代币账户不存在，请确保地址正确';
    }
    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return 'Solana网络连接超时，请稍后重试';
    }
    if (errorMessage.includes('blockhash')) {
      return 'Solana区块哈希过期，请重试交易';
    }
    if (errorMessage.includes('rate limit')) {
      return 'Solana API请求过于频繁，请稍后重试';
    }

    return errorMessage || 'Solana操作失败，请检查网络连接和余额';
  };

  // Pagination logic
  const getPaginatedItems = <T,>(items: T[], currentPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  };

  const getTotalPages = (items: T[]) => {
    return Math.ceil(items.length / itemsPerPage);
  };

  const paginatedTransactions = getPaginatedItems(transactions, txCurrentPage);
  const paginatedRecipients = getPaginatedItems(recipients, recipientsCurrentPage);
  const txTotalPages = getTotalPages(transactions);
  const recipientsTotalPages = getTotalPages(recipients);

  const formatPaginationInfo = (currentPage: number, items: T[]) => {
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, items.length);
    return `显示 ${startIndex} 到 ${endIndex} 条，共 ${items.length} 条记录`;
  };

  const renderPagination = (currentPage: number, totalPages: number, setCurrentPage: (page: number) => void) => {
    const getVisiblePages = () => {
      const pages: (number | string)[] = [];

      if (totalPages <= 7) {
        // Show all pages if total is small
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Always show first page
        pages.push(1);

        // Show ellipsis if current page is far from start
        if (currentPage > 3) {
          pages.push('...');
        }

        // Show pages around current page
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) {
          if (i !== 1 && i !== totalPages) {
            pages.push(i);
          }
        }

        // Show ellipsis if current page is far from end
        if (currentPage < totalPages - 2) {
          pages.push('...');
        }

        // Always show last page
        if (totalPages > 1) {
          pages.push(totalPages);
        }
      }

      return pages;
    };

    return (
      <div className="join">
        <button
          className="join-item btn btn-sm"
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
        >
          «
        </button>
        <button
          className="join-item btn btn-sm"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          ‹
        </button>
        {getVisiblePages().map((page, index) => {
          if (page === '...') {
            return (
              <button key={`ellipsis-${index}`} className="join-item btn btn-sm btn-disabled">
                ...
              </button>
            );
          }

          return (
            <button
              key={page}
              className={`join-item btn btn-sm ${currentPage === page ? 'btn-active' : ''}`}
              onClick={() => setCurrentPage(page as number)}
            >
              {page}
            </button>
          );
        })}
        <button
          className="join-item btn btn-sm"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          ›
        </button>
        <button
          className="join-item btn btn-sm"
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
        >
          »
        </button>
      </div>
    );
  };

  const handleExportPrivateKey = async () => {
    if (!campaign?.walletPrivateKeyBase64) {
      alert('该活动没有可导出的私钥');
      return;
    }

    try {
      if (window.electronAPI?.wallet) {
        const privateKey = await window.electronAPI.wallet.exportPrivateKey(campaign.walletPrivateKeyBase64);

        // 显示自定义私钥弹窗
        setExportedWallet({
          address: campaign.walletAddress || '',
          privateKey: privateKey
        });
        setShowPrivateKeyModal(true);
        setCopied(false);
      } else {
        alert('钱包服务不可用');
      }
    } catch (error) {
      console.error('Failed to export private key:', error);
      alert('导出私钥失败: ' + (error instanceof Error ? error.message : '未知错误'));
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

  // Helper function to get chain by name or chainId using only database data
  const getChainByName = (chainValue: string | number | undefined) => {
    if (!chainValue) return undefined;

    const chainStr = String(chainValue);
    const chainIdAsNumber = parseInt(chainStr);

    // 1. Try exact name match first
    let chain = chains.find(c => c.name === chainStr);
    if (chain) return chain;

    // 2. Try matching by chainId (common scenario)
    if (!isNaN(chainIdAsNumber)) {
      chain = chains.find(c => c.chainId === chainIdAsNumber);
      if (chain) return chain;
    }

    // 3. Try case-insensitive name match
    chain = chains.find(c => c.name.toLowerCase() === chainStr.toLowerCase());
    if (chain) return chain;

    // 4. Try partial match based on actual database chain names
    for (const dbChain of chains) {
      const dbChainNameLower = dbChain.name.toLowerCase();
      const inputLower = chainStr.toLowerCase();

      // Check if input contains part of db chain name or vice versa
      if (dbChainNameLower.includes(inputLower) || inputLower.includes(dbChainNameLower)) {
        return dbChain;
      }
    }

    return undefined;
  };

  // Refresh wallet balances
  const refreshBalances = async () => {
    if (!campaign?.walletAddress || !campaign.chain) return;

    setIsRefreshingBalance(true);
    try {
      if (window.electronAPI?.wallet && campaign.walletAddress) {
        let nativeBalance, tokenBalance = null;

        if (isSolanaChain(campaign.chain)) {
          // Solana逻辑
          if (window.electronAPI?.solana) {
            try {
              // 获取SOL余额
              const solBalance = await window.electronAPI.solana.getBalance(
                getChainByName(campaign.chain)?.rpcUrl || 'https://solana-rpc.publicnode.com',
                campaign.walletAddress
              );

              nativeBalance = { native: solBalance.balance || '0' };

              // 如果是SPL代币，获取代币余额
              if (campaign.tokenAddress &&
                  campaign.tokenAddress !== 'So11111111111111111111111111111111111111112') {
                try {
                  const splBalance = await window.electronAPI.solana.getBalance(
                    getChainByName(campaign.chain)?.rpcUrl || 'https://solana-rpc.publicnode.com',
                    campaign.walletAddress,
                    campaign.tokenAddress
                  );
                  tokenBalance = { token: splBalance.balance || '0' };
                } catch (tokenError) {
                  console.warn('Failed to get SPL token balance:', tokenError);
                  tokenBalance = null;
                }
              }
            } catch (error) {
              console.error('Failed to get Solana balances:', error);
              // 如果Solana API失败，尝试使用通用API作为fallback
              try {
                nativeBalance = await window.electronAPI.wallet.getBalance(
                  campaign.walletAddress,
                  campaign.chain
                );
                if (campaign.tokenAddress &&
                    campaign.tokenAddress !== 'So11111111111111111111111111111111111111112') {
                  tokenBalance = await window.electronAPI.wallet.getBalance(
                    campaign.walletAddress,
                    campaign.chain,
                    campaign.tokenAddress,
                    campaign.tokenDecimals
                  );
                }
              } catch (fallbackError) {
                console.error('Fallback balance query also failed:', fallbackError);
                nativeBalance = { native: '0' };
                tokenBalance = null;
              }
            }
          } else {
            console.warn('Solana API not available, skipping balance refresh');
            nativeBalance = { native: '0' };
            tokenBalance = null;
          }
        } else {
          // EVM逻辑
          nativeBalance = await window.electronAPI.wallet.getBalance(
            campaign.walletAddress,
            campaign.chain
          );

          // Get token balance if token address is provided
          if (campaign.tokenAddress && campaign.tokenAddress !== '0x0000000000000000000000000000000000000000') {
            try {
              tokenBalance = await window.electronAPI.wallet.getBalance(
                campaign.walletAddress,
                campaign.chain,
                campaign.tokenAddress,
                campaign.tokenDecimals
              );
            } catch (tokenError) {
              console.warn('Failed to get token balance:', tokenError);
              tokenBalance = null;
            }
          }
        }

        setWalletBalances({
          native: {
            current: nativeBalance?.native || '0',
            total: '∞' // No total limit for native currency
          },
          token: {
            current: tokenBalance?.token || '0',
            total: campaign.totalAmount || '0'
          }
        });

        // Log successful refresh
        console.log('Balances refreshed successfully:', {
          native: nativeBalance.native,
          token: tokenBalance?.token
        });
      }
    } catch (error) {
      console.error('Failed to refresh balances:', error);
      // Set fallback values on error
      setWalletBalances({
        native: {
          current: '0',
          total: '∞'
        },
        token: {
          current: '0',
          total: campaign.totalAmount || '0'
        }
      });
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  // Auto-refresh balances every 10 seconds
  useEffect(() => {
    if (campaign?.walletAddress && campaign.status === 'SENDING') {
      refreshBalances();
      const interval = setInterval(refreshBalances, 10000);
      return () => clearInterval(interval);
    }
  }, [campaign?.walletAddress, campaign?.status, campaign?.chain]);

  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="alert alert-error max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>活动未找到</span>
        </div>
      </div>
    );
  }

  const progressPercentage = Math.round((campaign.completedRecipients / campaign.totalRecipients) * 100);
  const remainingRecipients = campaign.totalRecipients - campaign.completedRecipients - campaign.failedRecipients;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
        </div>
        <div className="flex gap-2">
          {campaign && (campaign.status === 'CREATED' || campaign.status === 'FUNDED') && !isSolanaChain(campaign.chain) && (
            <button
              onClick={handleDeployContract}
              className="btn btn-primary"
            >
                🚀 部署合约
            </button>
          )}
          {campaign && campaign.status === 'FUNDED' && isSolanaChain(campaign.chain) && (
            <button
              onClick={() => navigate(`/campaign/${id}/start`)}
              className="btn btn-success"
            >
                🚀 开始发送
            </button>
          )}
          {campaign && (campaign.status === 'SENDING' || campaign.status === 'PAUSED') && (
            <>
              <button
                onClick={handlePauseResume}
                className={`btn ${campaign.status === 'PAUSED' ? 'btn-success' : 'btn-warning'}`}
              >
                {campaign.status === 'PAUSED' ? '▶️ 恢复' : '⏸️ 暂停'}
              </button>
              {campaign.status === 'PAUSED' && campaign.failedRecipients > 0 && (
                <button
                  onClick={handleRetryFailedTransactions}
                  className="btn btn-info"
                >
                  🔄 重试失败交易
                </button>
              )}
            </>
          )}
          <button
            onClick={() => navigate('/')}
            className="btn btn-ghost"
          >
            ← 返回活动列表
          </button>
        </div>
      </div>

      {/* Progress Section */}
      <div className="card bg-base-100 shadow-sm mb-8">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title">发送进度</h2>
            <div className="text-2xl font-bold text-primary">{progressPercentage}%</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>已完成 {campaign.completedRecipients} / {campaign.totalRecipients} 个地址</span>
              <span className="text-success">成功 {campaign.completedRecipients}</span>
              <span className="text-error">失败 {campaign.failedRecipients}</span>
              <span className="text-warning">待发送 {remainingRecipients}</span>
            </div>
            <progress
              className="progress progress-success w-full"
              value={progressPercentage}
              max="100"
            ></progress>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-primary">
            📋
          </div>
          <div className="stat-title">总地址数</div>
          <div className="stat-value text-primary">{campaign.totalRecipients}</div>
          <div className="stat-desc text-info">100% 目标</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-success">
            ✅
          </div>
          <div className="stat-title">成功发送</div>
          <div className="stat-value text-success">{campaign.completedRecipients}</div>
          <div className="stat-desc text-success">↑ {progressPercentage}%</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-error">
            ❌
          </div>
          <div className="stat-title">失败数量</div>
          <div className="stat-value text-error">{campaign.failedRecipients}</div>
          <div className="stat-desc text-error">{Math.round((campaign.failedRecipients / campaign.totalRecipients) * 100)}%</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-warning">
            ⏳
          </div>
          <div className="stat-title">待发送</div>
          <div className="stat-value text-warning">{remainingRecipients}</div>
          <div className="stat-desc text-warning">{100 - progressPercentage}%</div>
        </div>
      </div>

      {/* Campaign Info & Wallet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Campaign Info */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title flex items-center gap-2">
              <span>ℹ️</span>
              活动信息
            </h2>
            <div className="space-y-4">
              {/* 主要信息 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-base-content/70">活动状态:</span>
                  <div>{getStatusBadge(campaign.status)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-base-content/70">区块链网络:</span>
                  <div>
                    {(() => {
                      const chain = getChainByName(campaign.chain);
                      if (chain) {
                        return (
                          <div className="badge text-xs font-medium px-2 py-1 gap-1 border-0" style={{
                            backgroundColor: `${chain.color}20`,
                            color: chain.color,
                            border: `1px solid ${chain.color}40`
                          }}>
                            {chain.name}
                          </div>
                        );
                      } else {
                        return (
                          <div className="badge badge-neutral">
                            {campaign.chain || 'Unknown Chain'}
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              </div>

              {/* 次要信息 */}
              <div className="divider"></div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-base-content/70">活动ID:</span>
                  <div className="text-sm font-mono bg-base-200 px-2 py-1 rounded">
                    {campaign.id && typeof campaign.id === 'string' ? campaign.id : campaign.id && typeof campaign.id === 'number' ? String(campaign.id) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-base-content/70">创建时间:</span>
                  <span className="text-sm">{formatDate(campaign.createdAt)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-base-content/70">代币合约:</span>
                  <span className="text-sm font-mono bg-base-200 px-2 py-1 rounded whitespace-nowrap">
                    {campaign.tokenAddress}
                  </span>
                </div>
                {campaign.contractAddress && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-base-content/70">批量合约:</span>
                    <span className="text-sm font-mono bg-base-200 px-2 py-1 rounded whitespace-nowrap">
                      {campaign.contractAddress}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Wallet */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title flex items-center gap-2">
              <span>💳</span>
              活动钱包
            </h2>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">钱包地址</div>
                <div className="text-sm font-mono bg-base-200 px-2 py-1 rounded">
                  {campaign.walletAddress}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium">当前余额</div>
                  <button
                    onClick={refreshBalances}
                    disabled={isRefreshingBalance}
                    className="btn btn-ghost btn-xs"
                  >
                    {isRefreshingBalance ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                      '🔄 刷新'
                    )}
                  </button>
                </div>
                <div className="space-y-4">
                  {/* Native Currency Balance (e.g., ETH, BNB, MATIC) */}
                  <div className="p-3 bg-base-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-success"></div>
                      <span className="text-sm font-medium">
                        {(() => {
                          const chain = getChainByName(campaign.chain);
                          return chain ? chain.symbol : 'Native';
                        })()}
                      </span>
                    </div>
                    <div className="text-lg font-bold">
                      {parseFloat(walletBalances.native.current).toFixed(4)} {(() => {
                      const chain = getChainByName(campaign.chain);
                      return chain ? chain.symbol : 'ETH';
                    })()}
                    </div>
                  </div>

                  {/* Token Balance */}
                  <div className="p-3 bg-base-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-sm font-medium">{campaign.tokenSymbol}</span>
                    </div>
                    <div className="text-lg font-bold">
                      {parseFloat(walletBalances.token.current).toFixed(4)} {campaign.tokenSymbol}
                    </div>
                  </div>
                </div>
              </div>

              <div className="divider"></div>
              <div>
                <div className="text-sm text-base-content/60 mb-2">私钥管理</div>

                {campaign.walletPrivateKeyBase64 ? (
                  <>
                    <div className="alert alert-success">
                      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <div className="text-sm font-medium">私钥已保存</div>
                        <div className="text-xs">可以导出私钥来控制钱包资金</div>
                      </div>
                    </div>
                    <button
                      onClick={handleExportPrivateKey}
                      className="btn btn-primary btn-sm w-full mt-3"
                    >
                      🔑 导出私钥
                    </button>
                  </>
                ) : (
                  <>
                    <div className="alert alert-error">
                      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <div className="text-sm font-medium">私钥丢失警告</div>
                        <div className="text-xs">此活动创建时私钥未正确保存，无法导出私钥控制钱包</div>
                      </div>
                    </div>
                    <button
                      className="btn btn-disabled btn-sm w-full mt-3"
                      title="私钥未保存，无法导出"
                      disabled
                    >
                      🔑 私钥不可用
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Records */}
      <div className="card bg-base-100 shadow-sm mb-8">
        <div className="card-body">
          <div className="flex justify-between items-center mb-6">
            <h2 className="card-title flex items-center gap-2">
              <span>📊</span>
              交易记录
            </h2>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm">📥 导出</button>
              <button className="btn btn-ghost btn-sm">🔄 刷新</button>
              <button className="btn btn-ghost btn-sm">❌ 仅失败</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>批次</th>
                  <th>状态</th>
                  <th>地址数</th>
                  <th>交易哈希</th>
                  <th>Gas消耗</th>
                  <th className="text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover">
                    <td>
                      <div className="font-bold">#{tx.batchNumber}</div>
                      <div className="text-xs text-base-content/60">{formatDate(tx.createdAt)}</div>
                    </td>
                    <td>
                      {tx.status === 'success' && <div className="badge badge-success gap-1">✅ 成功</div>}
                      {tx.status === 'sending' && <div className="badge badge-info gap-1">🔄 发送中</div>}
                      {tx.status === 'pending' && <div className="badge badge-warning gap-1">⏳ 待发送</div>}
                      {tx.status === 'failed' && <div className="badge badge-error gap-1">❌ 失败</div>}
                    </td>
                    <td>
                      <div className="font-medium">{tx.addressCount}</div>
                    </td>
                    <td>
                      {tx.txHash ? (
                        <a
                          href={`https://polygonscan.com/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary link-hover text-sm font-mono"
                        >
                          {tx.txHash}
                        </a>
                      ) : (
                        <span className="text-base-content/40">-</span>
                      )}
                    </td>
                    <td>
                      {tx.gasUsed ? (
                        <span className="text-sm">{tx.gasUsed}</span>
                      ) : (
                        <span className="text-base-content/40">-</span>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="dropdown dropdown-end">
                        <button tabIndex={0} className="btn btn-ghost btn-xs">⋮</button>
                        <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32 z-[1]">
                          <li><a>查看详情</a></li>
                          <li><a>重新发送</a></li>
                          {tx.status === 'failed' && <li><a>查看错误</a></li>}
                        </ul>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-base-content/60">
              {formatPaginationInfo(txCurrentPage, transactions)}
            </div>
            {renderPagination(txCurrentPage, txTotalPages, setTxCurrentPage)}
          </div>
        </div>
      </div>

      {/* Recipients */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <div className="flex justify-between items-center mb-6">
            <h2 className="card-title flex items-center gap-2">
              <span>👥</span>
              接收地址列表
            </h2>
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm">📥 导出CSV</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>地址</th>
                  <th>金额</th>
                  <th>状态</th>
                  <th>交易哈希</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecipients.map((recipient, index) => (
                  <tr key={`${recipient.address}-${index}`} className="hover">
                    <td className="min-w-[400px]">
                      <div className="font-mono text-sm bg-base-200 px-2 py-1 rounded whitespace-normal break-all">
                        {recipient.address}
                      </div>
                    </td>
                    <td>
                      <div className="font-medium">{recipient.amount}</div>
                    </td>
                    <td>
                      {recipient.status === 'success' && <div className="badge badge-success gap-1">✅</div>}
                      {recipient.status === 'sending' && <div className="badge badge-info gap-1">🔄</div>}
                      {recipient.status === 'pending' && <div className="badge badge-warning gap-1">⏳</div>}
                      {recipient.status === 'failed' && <div className="badge badge-error gap-1">❌</div>}
                    </td>
                    <td>
                      {recipient.txHash ? (
                        <a
                          href={`https://polygonscan.com/tx/${recipient.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary link-hover text-sm font-mono"
                        >
                          {recipient.txHash}
                        </a>
                      ) : (
                        <span className="text-base-content/40">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-base-content/60">
              {formatPaginationInfo(recipientsCurrentPage, recipients)}
            </div>
            {renderPagination(recipientsCurrentPage, recipientsTotalPages, setRecipientsCurrentPage)}
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
                <li>• 私钥可以导入到 MetaMask、Trust Wallet 等钱包</li>
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