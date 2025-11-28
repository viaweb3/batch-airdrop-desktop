import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EVMChain } from '../types';
import BigNumber from 'bignumber.js';
import { isSolanaChain, exportPrivateKey } from '../utils/chainTypeUtils';


interface Campaign {
  id: string;
  name: string;
  chain: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals?: number;
  status: 'CREATED' | 'FUNDED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
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
  createdAt?: string;
  updatedAt?: string;
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
  const [totalAirdropAmount, setTotalAirdropAmount] = useState<string>('0');
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [showPrivateKeyModal, setShowPrivateKeyModal] = useState(false);
  const [exportedWallet, setExportedWallet] = useState<{ address: string; privateKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Withdrawal states
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawType, setWithdrawType] = useState<'tokens' | 'native'>('tokens');
  const [withdrawRecipient, setWithdrawRecipient] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Transaction filter states
  const [showFailedOnly, setShowFailedOnly] = useState(false);

  // Contract deployment states
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState('');
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<{ contractAddress: string; transactionHash: string } | null>(null);

  // Utility function to get native token symbol from database
  const getNativeTokenSymbol = (chainId: string): string => {
    // Find the chain from loaded chains data
    const chainIdNum = parseInt(chainId);
    const chain = chains.find(c => c.chainId === chainIdNum);

    // Return symbol from database or fallback to ETH
    return chain?.symbol || "ETH";
  };

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
        const chainsData = await window.electronAPI.chain.getAllChains();
        setChains(chainsData);
      }
    } catch (error) {
      console.error('Failed to load chains:', error);
    }
  };

  // Data consistency validation helper
  const validateDataConsistency = (
    campaignData: Campaign,
    recipientsData: Recipient[]
  ): string[] => {
    const warnings: string[] = [];

    // Count recipients by status
    const recipientCounts = {
      sent: recipientsData.filter(r => r.status === 'success').length,
      failed: recipientsData.filter(r => r.status === 'failed').length,
      pending: recipientsData.filter(r => r.status === 'pending' || r.status === 'sending').length,
    };

    // Validate completed recipients count
    if (recipientCounts.sent !== campaignData.completedRecipients) {
      warnings.push(
        `[数据不一致] 完成数量: 接收者表=${recipientCounts.sent}, 活动表=${campaignData.completedRecipients}, 差异=${Math.abs(recipientCounts.sent - campaignData.completedRecipients)}`
      );
    }

    // Validate failed recipients count
    if (recipientCounts.failed !== campaignData.failedRecipients) {
      warnings.push(
        `[数据不一致] 失败数量: 接收者表=${recipientCounts.failed}, 活动表=${campaignData.failedRecipients || 0}, 差异=${Math.abs(recipientCounts.failed - (campaignData.failedRecipients || 0))}`
      );
    }

    // Validate total recipients
    const totalInRecipients = recipientsData.length;
    if (totalInRecipients !== campaignData.totalRecipients) {
      warnings.push(
        `[数据不一致] 总数: 接收者表=${totalInRecipients}, 活动表=${campaignData.totalRecipients}, 差异=${Math.abs(totalInRecipients - campaignData.totalRecipients)}`
      );
    }

    // Validate progress calculation
    const calculatedProgress = campaignData.totalRecipients > 0
      ? Math.round((campaignData.completedRecipients / campaignData.totalRecipients) * 100)
      : 0;
    const actualProgress = totalInRecipients > 0
      ? Math.round((recipientCounts.sent / totalInRecipients) * 100)
      : 0;

    if (Math.abs(calculatedProgress - actualProgress) > 1) { // Allow 1% tolerance for rounding
      warnings.push(
        `[进度不一致] 计算进度=${calculatedProgress}%, 实际进度=${actualProgress}%, 差异=${Math.abs(calculatedProgress - actualProgress)}%`
      );
    }

    if (warnings.length > 0) {
      console.warn('⚠️ 数据一致性检查发现问题:', warnings);
      console.warn('活动数据:', {
        totalRecipients: campaignData.totalRecipients,
        completedRecipients: campaignData.completedRecipients,
        failedRecipients: campaignData.failedRecipients,
      });
      console.warn('接收者统计:', recipientCounts);
    } else {
      console.log('✅ 数据一致性检查通过');
    }

    return warnings;
  };

  const loadCampaign = async () => {
    setLoading(true);
    try {
      if (!id || id === 'undefined') {
        throw new Error('Campaign ID is required');
      }

      if (!window.electronAPI?.campaign) {
        throw new Error('Campaign API not available');
      }

      // Load all data in parallel for better performance
      const [detailsResult, txResult, recipientsResult] = await Promise.allSettled([
        window.electronAPI.campaign.getDetails(id),
        window.electronAPI.campaign.getTransactions(id, { limit: 100 }),
        window.electronAPI.campaign.getRecipients(id)
      ]);

      // Process campaign details (critical - must succeed)
      if (detailsResult.status === 'fulfilled' && detailsResult.value) {
        setCampaign({
          ...detailsResult.value.campaign,
          chainId: parseInt(detailsResult.value.campaign.chain),
        });
      } else {
        const error = detailsResult.status === 'rejected' ? detailsResult.reason : 'Campaign not found';
        throw new Error(error instanceof Error ? error.message : String(error));
      }

      // Process transactions (non-critical)
      if (txResult.status === 'fulfilled' && txResult.value && Array.isArray(txResult.value)) {
        const batchTransactions = txResult.value.filter((tx: any) => tx.txType === 'BATCH_SEND');
        setTransactions(batchTransactions.map((tx: any, index: number) => ({
          id: tx.id.toString(),
          batchNumber: index + 1, // Sequential batch number: first transaction = batch 1
          status: tx.status === 'CONFIRMED' ? 'success' : tx.status === 'PENDING' ? 'sending' : 'failed',
          addressCount: tx.recipientCount || 0,
          txHash: tx.txHash,
          gasUsed: tx.gasUsed?.toString(),
          createdAt: tx.createdAt,
        })));
      } else {
        const error = txResult.status === 'rejected' ? txResult.reason : 'Unknown error';
        console.error('Failed to load transactions:', error);
        console.error('Transaction error details:', {
          campaignId: id,
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined
        });
        setTransactions([]);
      }

      // Process recipients (non-critical)
      if (recipientsResult.status === 'fulfilled' && recipientsResult.value && Array.isArray(recipientsResult.value)) {
        const mappedRecipients = recipientsResult.value.map((r: any) => ({
          address: r.address,
          amount: r.amount,
          status: r.status === 'SENT' ? 'success' : r.status === 'PENDING' ? 'pending' : r.status === 'FAILED' ? 'failed' : 'sending',
          txHash: r.txHash,
          error: r.errorMessage,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
        setRecipients(mappedRecipients);

        // Calculate total airdrop amount using BigNumber for precision
        const total = recipientsResult.value.reduce((sum: BigNumber, r: any) => {
          return sum.plus(new BigNumber(r.amount || '0'));
        }, new BigNumber(0));
        setTotalAirdropAmount(total.toString());
      } else {
        const error = recipientsResult.status === 'rejected' ? recipientsResult.reason : 'Unknown error';
        console.error('Failed to load recipients:', error);
        setRecipients([]);
        setTotalAirdropAmount('0');
      }

      // Refresh wallet balances after loading campaign data
      try {
        await refreshBalances();
        console.log('Campaign loaded and balances refreshed successfully');
      } catch (balanceError) {
        console.warn('Failed to refresh balances after loading campaign:', balanceError);
        // Don't block page load, just log the warning
      }

      // Validate data consistency after all data is loaded
      if (detailsResult.status === 'fulfilled' && recipientsResult.status === 'fulfilled') {
        const campaignData = {
          ...detailsResult.value.campaign,
          chainId: parseInt(detailsResult.value.campaign.chain),
        };
        const recipientsData = recipientsResult.value.map((r: any) => ({
          address: r.address,
          amount: r.amount,
          status: r.status === 'SENT' ? 'success' : r.status === 'PENDING' ? 'pending' : r.status === 'FAILED' ? 'failed' : 'sending',
          txHash: r.txHash,
          error: r.errorMessage,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
        validateDataConsistency(campaignData, recipientsData);
      }

    } catch (error) {
      console.error('Failed to load campaign:', error);
      alert('加载活动详情失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const loadRecipients = async () => {
    try {
      if (!id || !window.electronAPI?.campaign) return;

      const recipientsData = await window.electronAPI.campaign.getRecipients(id);
      if (recipientsData && Array.isArray(recipientsData)) {
        const mappedRecipients = recipientsData.map((r: any) => ({
          address: r.address,
          amount: r.amount,
          status: r.status === 'SENT' ? 'success' : r.status === 'PENDING' ? 'pending' : r.status === 'FAILED' ? 'failed' : 'sending',
          txHash: r.txHash,
          error: r.errorMessage,
        }));
        setRecipients(mappedRecipients);

        // Recalculate total airdrop amount
        const total = recipientsData.reduce((sum: BigNumber, r: any) => {
          return sum.plus(new BigNumber(r.amount || '0'));
        }, new BigNumber(0));
        setTotalAirdropAmount(total.toString());
      }
    } catch (error) {
      console.error('Failed to load recipients:', error);
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
      case 'READY':
        return <div className="badge badge-accent gap-1">⚡ 就绪</div>;
      case 'FUNDED':
        return <div className="badge badge-info gap-1">💰 已充值</div>;
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
      case 'READY': return 'bg-purple-100 text-purple-800';
      case 'FUNDED': return 'bg-blue-100 text-blue-800';
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

  const handleStartCampaign = async () => {
    if (!campaign || !id) return;

    // 确认对话框
    const confirmed = confirm(`确认开始发送代币吗？\n\n活动名称: ${campaign.name}\n发送数量: ${campaign.totalRecipients - campaign.completedRecipients - campaign.failedRecipients} 个接收者\n\n点击"确定"开始执行批量发送。`);

    if (!confirmed) {
      return; // 用户取消了
    }

    try {
      if (window.electronAPI?.campaign) {
        console.log('Starting campaign:', id);
        await window.electronAPI.campaign.start(id);
        console.log('Campaign started successfully');

        // 成功启动后重新加载活动状态
        await loadCampaign();
        alert('活动已开始发送！页面将每5秒自动刷新状态。');
      }
    } catch (error) {
      console.error('Failed to start campaign:', error);
      alert('启动失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  const handleDeployContract = async () => {
    if (!campaign || !id || !campaign.walletAddress || !campaign.chain) return;

    let nativeBalance = 0;
    let estimatedDeploymentCost = "0.0015"; // 默认估算值
    let minGasRequired = 0.0015; // 默认最低要求

    // 先获取最新余额
    try {
      const freshBalance = await window.electronAPI.wallet.getBalance(
        campaign.walletAddress,
        campaign.chain
      );

      nativeBalance = parseFloat(freshBalance.native || '0');
    } catch (balanceError) {
      console.error('Failed to check balance before deployment:', balanceError);
      setDeploymentError('无法获取余额信息，请稍后重试');
      setShowDeploymentModal(true);
      return;
    }

    // 获取gas估算信息来动态计算最低余额要求
    try {
      // 获取当前链的gas价格估算
      if (window.electronAPI?.blockchain && campaign.chain) {
        const gasEstimate = await window.electronAPI.blockchain.estimateGas(
          campaign.chain,
          campaign.walletAddress,
          "0x0000000000000000000000000000000000000000", // 合约地址估算
          campaign.tokenAddress,
          0 // 收件人数量为0，只估算部署
        );

        // 将估算的gas费用转换为原生代币 (使用ContractService中的500K gas限制)
        const gasLimit = 500000; // 合约部署的实际gas限制
        const gasPriceGwei = parseFloat(gasEstimate.gasPrice) || 30; // 默认30 Gwei
        const gasCostWei = gasLimit * gasPriceGwei * 1e9; // 转换为wei
        estimatedDeploymentCost = (gasCostWei / 1e18).toFixed(6); // 转换为原生代币单位

        // 设置最低余额要求为估算成本的1.5倍（包含安全缓冲）
        minGasRequired = parseFloat(estimatedDeploymentCost) * 1.5;

              }
    } catch (gasError) {
      console.warn('Failed to estimate deployment gas cost, using default:', gasError);
    }

    const nativeTokenSymbol = getNativeTokenSymbol(campaign.chain);

    // 检查余额是否足够（使用动态计算的最低要求）
    if (nativeBalance < minGasRequired) {
      setDeploymentError(`Gas余额不足，请确保钱包有至少 ${minGasRequired.toFixed(6)} ${nativeTokenSymbol} 来支付部署费用。当前余额: ${nativeBalance.toFixed(6)} ${nativeTokenSymbol}`);
      setShowDeploymentModal(true);
      return;
    }

    // 显示部署确认对话框
    const confirmed = confirm(`确定要为此活动部署合约吗？

合约部署 Gas 费用详情：
• 当前余额: ${nativeBalance.toFixed(6)} ${nativeTokenSymbol}
• 预计部署费用: ~${estimatedDeploymentCost} ${nativeTokenSymbol}
• 最低余额要求: ${minGasRequired.toFixed(6)} ${nativeTokenSymbol} (含1.5倍安全缓冲)

注意：部署后无法撤销，请确认链配置和代币地址正确。`);
    if (!confirmed) return;

    // 开始部署流程
    setShowDeploymentModal(true);
    setDeploymentProgress('正在准备合约部署...');
    setDeploymentError(null);
    setIsDeploying(true);

    try {
      if (window.electronAPI?.campaign) {
        setDeploymentProgress('正在部署合约，请稍候...');

        const result = await window.electronAPI.campaign.deployContract(id);

        setDeploymentProgress('合约部署成功！');
        setDeploymentResult(result);

        // 刷新活动状态
        setTimeout(async () => {
          await loadCampaign();
          await refreshBalances();
        }, 1000);

      }
    } catch (error) {
      console.error('Failed to deploy contract:', error);
      const errorMessage = getSolanaSpecificErrorMessage(error);
      setDeploymentError(errorMessage);
      setDeploymentProgress('部署失败');
    } finally {
      setIsDeploying(false);
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

  const filteredTransactions = showFailedOnly ? transactions.filter(tx => tx.status === 'failed') : transactions;
  const paginatedTransactions = getPaginatedItems(filteredTransactions, txCurrentPage);
  const paginatedRecipients = getPaginatedItems(recipients, recipientsCurrentPage);
  const txTotalPages = getTotalPages(filteredTransactions);
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
      // 使用统一的私钥导出函数
      const privateKeyDisplay = await exportPrivateKey(campaign.walletPrivateKeyBase64 || '', campaign);

      // 显示自定义私钥弹窗
      setExportedWallet({
        address: campaign.walletAddress || '',
        privateKey: privateKeyDisplay
      });
      setShowPrivateKeyModal(true);
      setCopied(false);
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

  // Withdrawal handlers
  const handleOpenWithdrawModal = (type: 'tokens' | 'native') => {
    if (!campaign?.walletPrivateKeyBase64) {
      alert('该活动没有可用的私钥，无法进行资金回收');
      return;
    }
    setWithdrawType(type);
    setWithdrawRecipient('');
    setShowWithdrawModal(true);
  };

  const handleWithdraw = async () => {
    if (!campaign?.id || !withdrawRecipient) {
      alert('请输入接收地址');
      return;
    }

    setIsWithdrawing(true);
    try {
      let result;
      if (withdrawType === 'tokens') {
        result = await window.electronAPI.campaign.withdrawTokens(campaign.id, withdrawRecipient);
        alert(`代币回收成功!\n交易哈希: ${result.txHash}\n回收数量: ${result.amount} ${campaign.tokenSymbol}`);
      } else {
        result = await window.electronAPI.campaign.withdrawNative(campaign.id, withdrawRecipient);
        const nativeTokenSymbol = getNativeTokenSymbol(campaign.chain);
        alert(`${nativeTokenSymbol} 原生代币回收成功!\n交易哈希: ${result.txHash}\n回收数量: ${result.amount} ${nativeTokenSymbol}`);
      }
      setShowWithdrawModal(false);
      // Refresh balance
      await refreshBalances();
    } catch (error) {
      console.error('Withdrawal failed:', error);
      alert('资金回收失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleCloseModal = () => {
    setShowPrivateKeyModal(false);
    setExportedWallet(null);
    setCopied(false);
  };

  // Helper function to get transaction explorer URL
  const getTransactionUrl = (txHash: string): string => {
    if (!campaign?.chain) return '#';

    const chain = getChainByName(campaign.chain);
    if (!chain?.explorerUrl) return '#';

    // Special handling for Solana explorers with cluster parameters
    if (chain.type === 'solana') {
      const url = new URL(chain.explorerUrl);
      const baseUrl = `${url.protocol}//${url.host}`;
      const clusterParam = url.searchParams.get('cluster');

      if (clusterParam) {
        return `${baseUrl}/tx/${txHash}?cluster=${clusterParam}`;
      } else {
        return `${baseUrl}/tx/${txHash}`;
      }
    }

    // Handle other chains (EVM, etc.)
    const baseUrl = chain.explorerUrl.endsWith('/') ? chain.explorerUrl : chain.explorerUrl + '/';
    return `${baseUrl}tx/${txHash}`;
  };

  // Transaction history handlers
  const handleExportTransactions = () => {
    const dataToExport = showFailedOnly ? transactions.filter(tx => tx.status === 'failed') : transactions;

    const csvContent = [
      ['批次', '状态', '地址数', '交易哈希', 'Gas消耗', '创建时间'].join(','),
      ...dataToExport.map(tx => [
        `#${tx.batchNumber}`,
        tx.status === 'success' ? '成功' : tx.status === 'failed' ? '失败' : tx.status === 'sending' ? '发送中' : '待发送',
        tx.addressCount,
        tx.txHash || '',
        tx.gasUsed || '',
        formatDate(tx.createdAt)
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transactions-${campaign?.name || 'export'}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleRefreshTransactions = async () => {
    if (!id) return;
    try {
      const txData = await window.electronAPI.campaign.getTransactions(id, { limit: 100 });
      if (txData && Array.isArray(txData)) {
        const batchTransactions = txData.filter((tx: any) => tx.txType === 'BATCH_SEND');
        setTransactions(batchTransactions.map((tx: any, index: number) => ({
          id: tx.id.toString(),
          batchNumber: index + 1,
          status: tx.status === 'CONFIRMED' ? 'success' : tx.status === 'PENDING' ? 'sending' : 'failed',
          addressCount: tx.recipientCount || 0,
          txHash: tx.txHash,
          gasUsed: tx.gasUsed?.toString(),
          createdAt: tx.createdAt,
        })));
      }
    } catch (error) {
      console.error('Failed to refresh transactions:', error);
      alert('刷新交易记录失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  const handleToggleFilter = () => {
    setShowFailedOnly(!showFailedOnly);
    setTxCurrentPage(1); // Reset to first page when filtering
  };

  const handleExportRecipients = () => {
    const csvContent = [
      ['接收地址', '金额', '状态', '交易哈希', '交易时间'].join(','),
      ...recipients.map(recipient => [
        recipient.address,
        recipient.amount,
        recipient.status === 'success' ? '成功' : recipient.status === 'failed' ? '失败' : recipient.status === 'sending' ? '发送中' : '待发送',
        recipient.txHash || '',
        recipient.updatedAt ? formatDate(recipient.updatedAt) : recipient.createdAt ? formatDate(recipient.createdAt) : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `recipients-${campaign?.name || 'export'}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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

        if (isSolanaChain(campaign)) {
          // Solana逻辑
          if (window.electronAPI?.solana) {
            try {
              // 获取SOL余额
              const chainRpcUrl = getChainByName(campaign.chain)?.rpcUrl;
              if (!chainRpcUrl) {
                console.error('No RPC URL found for Solana chain');
                return;
              }
              const solBalance = await window.electronAPI.solana.getBalance(
                chainRpcUrl,
                campaign.walletAddress
              );

              nativeBalance = { native: solBalance.balance || '0' };

              // 如果是SPL代币，获取代币余额
              if (campaign.tokenAddress &&
                  campaign.tokenAddress !== 'So11111111111111111111111111111111111111112') {
                try {
                  const chainRpcUrl = getChainByName(campaign.chain)?.rpcUrl;
                  if (!chainRpcUrl) {
                    console.error('No RPC URL found for Solana chain');
                    return;
                  }
                  const splBalance = await window.electronAPI.solana.getBalance(
                    chainRpcUrl,
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

  // Auto-refresh campaign data and balances with optimized intervals
  useEffect(() => {
    if (!campaign?.walletAddress || !id) return;

    // Determine refresh interval based on campaign status
    let refreshInterval: number | null = null;

    if (campaign.status === 'SENDING') {
      // SENDING status: Fast refresh every 3 seconds for real-time progress
      refreshInterval = 3000;
    } else if (['PAUSED', 'READY', 'FUNDED'].includes(campaign.status)) {
      // Active but not sending: Moderate refresh every 10 seconds
      refreshInterval = 10000;
    }
    // COMPLETED/FAILED/CREATED status: No auto-refresh

    if (refreshInterval) {
      const interval = setInterval(() => {
        loadCampaign(); // loadCampaign includes refreshBalances call
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [campaign?.status, campaign?.walletAddress, id]);

  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && (!campaign || campaign.status !== 'COMPLETED')) {
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
          {campaign && (campaign.status === 'CREATED' || campaign.status === 'FUNDED') && !isSolanaChain(campaign) && (
            <button
              onClick={handleDeployContract}
              className="btn btn-primary"
            >
                🚀 部署合约
            </button>
          )}
          {campaign && campaign.status === 'CREATED' && isSolanaChain(campaign) && (
            <button
              onClick={async () => {
                if (!id) return;
                try {
                  await window.electronAPI.campaign.updateStatus(id, 'READY');
                  await loadCampaign();
                  alert('活动已标记为就绪状态！');
                } catch (error) {
                  console.error('Failed to update status:', error);
                  alert('更新状态失败');
                }
              }}
              className="btn btn-primary"
            >
              ✅ 标记为已充值
            </button>
          )}
          {campaign && campaign.status === 'READY' && (
            <button
              onClick={handleStartCampaign}
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
            ← 返回仪表盘
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
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-base-content/70">空投总量:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-primary">
                      {totalAirdropAmount}
                    </span>
                    <span className="text-sm text-base-content/70">{campaign.tokenSymbol || 'tokens'}</span>
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

                    {/* Withdrawal buttons */}
                    <div className="divider my-3"></div>
                    <div className="text-sm text-base-content/60 mb-2">资金回收</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleOpenWithdrawModal('tokens')}
                        className="btn btn-warning btn-sm"
                      >
                        💰 回收代币
                      </button>
                      <button
                        onClick={() => handleOpenWithdrawModal('native')}
                        className="btn btn-warning btn-sm"
                      >
                        💎 回收原生币
                      </button>
                    </div>
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
              <button onClick={handleExportTransactions} className="btn btn-ghost btn-sm">📥 导出</button>
              <button onClick={handleRefreshTransactions} className="btn btn-ghost btn-sm">🔄 刷新</button>
              <button
                onClick={handleToggleFilter}
                className={`btn btn-sm ${showFailedOnly ? 'btn-error' : 'btn-ghost'}`}
              >
                {showFailedOnly ? '✓ 仅失败' : '❌ 仅失败'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr className="border-b border-base-300">
                  <th className="bg-base-200">批次</th>
                  <th className="bg-base-200">状态</th>
                  <th className="bg-base-200">地址数</th>
                  <th className="bg-base-200">交易哈希</th>
                  <th className="bg-base-200">Gas消耗</th>
                  <th className="bg-base-200">交易时间</th>
                  <th className="bg-base-200 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover border-b border-base-200">
                    <td className="py-4">
                      <div className="font-bold text-base">#{tx.batchNumber}</div>
                    </td>
                    <td className="py-4">
                      {tx.status === 'success' && <div className="badge badge-success gap-1">✅ 成功</div>}
                      {tx.status === 'sending' && <div className="badge badge-info gap-1">🔄 发送中</div>}
                      {tx.status === 'pending' && <div className="badge badge-warning gap-1">⏳ 待发送</div>}
                      {tx.status === 'failed' && <div className="badge badge-error gap-1">❌ 失败</div>}
                    </td>
                    <td className="py-4">
                      <div className="font-medium">{tx.addressCount}</div>
                    </td>
                    <td className="py-4 max-w-xs">
                      {tx.txHash ? (
                        <a
                          href={getTransactionUrl(tx.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary link-hover text-sm font-mono truncate block"
                        >
                          {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                        </a>
                      ) : (
                        <span className="text-base-content/40">-</span>
                      )}
                    </td>
                    <td className="py-4">
                      {tx.gasUsed ? (
                        <span className="text-sm">{tx.gasUsed}</span>
                      ) : (
                        <span className="text-base-content/40">-</span>
                      )}
                    </td>
                    <td className="py-4">
                      <div className="text-sm text-base-content/70 whitespace-nowrap">{formatDate(tx.createdAt)}</div>
                    </td>
                    <td className="py-4 text-center">
                      <div className="flex gap-2 justify-center">
                        {tx.txHash && (
                          <a
                            href={getTransactionUrl(tx.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm"
                            title="在区块浏览器查看"
                          >
                            🔍
                          </a>
                        )}
                        {tx.status === 'failed' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            title="重新发送"
                            onClick={() => {
                              alert('重新发送功能待实现');
                            }}
                          >
                            🔄
                          </button>
                        )}
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
              <button onClick={handleExportRecipients} className="btn btn-primary btn-sm">📥 导出CSV</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr className="border-b border-base-300">
                  <th className="bg-base-200">地址</th>
                  <th className="bg-base-200">金额</th>
                  <th className="bg-base-200">状态</th>
                  <th className="bg-base-200">交易哈希</th>
                  <th className="bg-base-200">交易时间</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecipients.map((recipient, index) => (
                  <tr key={`${recipient.address}-${index}`} className="hover border-b border-base-200">
                    <td className="py-4 max-w-md">
                      <div className="font-mono text-sm bg-base-200 px-3 py-2 rounded whitespace-normal break-all">
                        {recipient.address}
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="font-medium">{recipient.amount}</div>
                    </td>
                    <td className="py-4">
                      {recipient.status === 'success' && <div className="badge badge-success gap-1">✅</div>}
                      {recipient.status === 'sending' && <div className="badge badge-info gap-1">🔄</div>}
                      {recipient.status === 'pending' && <div className="badge badge-warning gap-1">⏳</div>}
                      {recipient.status === 'failed' && <div className="badge badge-error gap-1">❌</div>}
                    </td>
                    <td className="py-4 max-w-xs">
                      {recipient.txHash ? (
                        <a
                          href={getTransactionUrl(recipient.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary link-hover text-sm font-mono truncate block"
                        >
                          {recipient.txHash.slice(0, 10)}...{recipient.txHash.slice(-8)}
                        </a>
                      ) : (
                        <span className="text-base-content/40">-</span>
                      )}
                    </td>
                    <td className="py-4">
                      <div className="text-sm text-base-content/70 whitespace-nowrap">
                        {recipient.updatedAt ? formatDate(recipient.updatedAt) :
                         recipient.createdAt ? formatDate(recipient.createdAt) : '-'}
                      </div>
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

      {/* Contract Deployment Modal */}
      {showDeploymentModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span>🚀</span>
                合约部署状态
              </h3>
              <button
                onClick={() => setShowDeploymentModal(false)}
                className="btn btn-sm btn-circle btn-ghost"
                disabled={isDeploying}
              >
                ✕
              </button>
            </div>

            {/* Progress Section */}
            <div className="mb-6">
              <div className="flex items-center gap-3">
                {isDeploying && (
                  <div className="loading loading-spinner loading-sm"></div>
                )}
                <div className={`text-sm ${isDeploying ? 'text-info' : deploymentError ? 'text-error' : 'text-success'}`}>
                  {deploymentProgress}
                </div>
              </div>

              {/* Progress Bar */}
              {isDeploying && (
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              )}
            </div>

            {/* Error Section */}
            {deploymentError && (
              <div className="alert alert-error mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-bold">部署失败</h3>
                  <div className="text-sm mt-1">{deploymentError}</div>
                </div>
              </div>
            )}

            {/* Success Section */}
            {deploymentResult && (
              <div className="alert alert-success mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-bold">合约部署成功！</h3>
                  <div className="text-sm mt-1">
                    <div className="mb-1">
                      <strong>合约地址:</strong>
                      <div className="font-mono text-xs bg-success/10 p-1 rounded mt-1 break-all">
                        {deploymentResult.contractAddress}
                      </div>
                    </div>
                    <div>
                      <strong>交易哈希:</strong>
                      <div className="font-mono text-xs bg-success/10 p-1 rounded mt-1 break-all">
                        {deploymentResult.transactionHash}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="modal-action">
              {deploymentError && (
                <button
                  onClick={() => {
                    setShowDeploymentModal(false);
                    setDeploymentError(null);
                  }}
                  className="btn"
                  disabled={isDeploying}
                >
                  关闭
                </button>
              )}

              {deploymentResult && (
                <>
                  <button
                    onClick={() => {
                      // Copy contract address to clipboard
                      navigator.clipboard.writeText(deploymentResult.contractAddress);
                    }}
                    className="btn btn-success"
                  >
                    📋 复制合约地址
                  </button>
                  <button
                    onClick={() => {
                      setShowDeploymentModal(false);
                      setDeploymentResult(null);
                    }}
                    className="btn"
                  >
                    完成
                  </button>
                </>
              )}

              {!deploymentError && !deploymentResult && (
                <button
                  onClick={() => setShowDeploymentModal(false)}
                  className="btn"
                  disabled={isDeploying}
                >
                  取消
                </button>
              )}
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !isDeploying && setShowDeploymentModal(false)}></div>
        </div>
      )}

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              {withdrawType === 'tokens' ? '💰 回收剩余代币' : '💎 回收剩余原生代币'}
            </h3>

            {/* Warning */}
            <div className="alert alert-warning mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm">
                {withdrawType === 'tokens'
                  ? `将钱包中的所有剩余 ${campaign?.tokenSymbol} 代币转移到指定地址`
                  : '将钱包中的剩余原生代币转移到指定地址（会保留gas费用）'}
              </span>
            </div>

            {/* Current Balance */}
            <div className="bg-base-200 p-3 rounded-lg mb-4">
              <div className="text-sm text-base-content/60">当前余额</div>
              <div className="text-lg font-bold">
                {withdrawType === 'tokens'
                  ? `${parseFloat(walletBalances.token.current).toFixed(4)} ${campaign?.tokenSymbol}`
                  : `${parseFloat(walletBalances.native.current).toFixed(6)} ${getNativeTokenSymbol(campaign.chain)}`}
              </div>
            </div>

            {/* Recipient Address Input */}
            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text font-medium">接收地址</span>
              </label>
              <input
                type="text"
                placeholder="请输入接收地址"
                className="input input-bordered w-full"
                value={withdrawRecipient}
                onChange={(e) => setWithdrawRecipient(e.target.value)}
                disabled={isWithdrawing}
              />
            </div>

            {/* Modal Actions */}
            <div className="modal-action">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="btn"
                disabled={isWithdrawing}
              >
                取消
              </button>
              <button
                onClick={handleWithdraw}
                className="btn btn-warning"
                disabled={isWithdrawing || !withdrawRecipient}
              >
                {isWithdrawing ? '处理中...' : '确认回收'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !isWithdrawing && setShowWithdrawModal(false)}></div>
        </div>
      )}
    </div>
  );
}