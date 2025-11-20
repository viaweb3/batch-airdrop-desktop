import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface Campaign {
  id: string;
  name: string;
  chain: string;
  tokenAddress: string;
  status: 'CREATED' | 'FUNDED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  totalRecipients: number;
  completedRecipients: number;
  walletAddress?: string;
  contractAddress?: string;
  contractDeployedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Recipient {
  address: string;
  amount: string;
  status?: 'pending' | 'sent' | 'failed';
  txHash?: string;
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [tokenInfo, setTokenInfo] = useState<{ symbol: string; name: string; decimals: number } | null>(null);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [totalAmount, setTotalAmount] = useState('0');
  const [approvedAmount, setApprovedAmount] = useState('0');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [deployingContract, setDeployingContract] = useState(false);
  const [gasBalance, setGasBalance] = useState('0');
  const [chainSymbol, setChainSymbol] = useState('');

  // 最小Gas余额常量（根据链动态设置）
  const MIN_GAS_FOR_DEPLOYMENT = '0.005'; // 默认值

  useEffect(() => {
    if (id) {
      loadCampaign();
    }
  }, [id]);

  const loadCampaign = async () => {
    try {
      if (window.electronAPI?.campaign && id) {
        const campaignData = await window.electronAPI.campaign.getById(id);
        setCampaign(campaignData);
      }
    } catch (error) {
      console.error('加载活动失败:', error);
    }
  };

  const loadTokenInfo = async () => {
    if (!campaign?.tokenAddress || !campaign?.chain) return;

    try {
      const chainService = await window.electronAPI?.chain.getEVMChains(true);
      const chain = chainService?.find((c: any) => c.chainId === parseInt(campaign.chain));

      if (chain && window.electronAPI?.contract) {
        const info = await window.electronAPI.contract.getTokenInfo(chain.rpcUrl, campaign.tokenAddress);
        setTokenInfo(info);
      }
    } catch (error) {
      console.error('加载代币信息失败:', error);
    }
  };

  const loadTokenBalance = async () => {
    if (!campaign?.walletAddress || !campaign?.chain || !campaign?.tokenAddress) return;

    try {
      if (window.electronAPI?.wallet) {
        const balance = await window.electronAPI.wallet.getBalance(
          campaign.walletAddress,
          campaign.chain,
          campaign.tokenAddress
        );
        setTokenBalance(balance.token || '0');
        setGasBalance(balance.native || '0');

        // 获取链符号
        const chainService = await window.electronAPI?.chain.getEVMChains(true);
        const chain = chainService?.find((c: any) => c.chainId === parseInt(campaign.chain));
        if (chain) {
          setChainSymbol(chain.symbol);
        }
      }
    } catch (error) {
      console.error('加载代币余额失败:', error);
    }
  };

  /**
   * 检查Gas余额是否足够
   */
  const hasEnoughGas = (): boolean => {
    const balance = parseFloat(gasBalance);
    const minRequired = parseFloat(MIN_GAS_FOR_DEPLOYMENT);
    return !isNaN(balance) && balance >= minRequired;
  };

  useEffect(() => {
    if (campaign) {
      loadTokenInfo();
      loadTokenBalance();
    }
  }, [campaign]);

  const importCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);

    try {
      if (window.electronAPI?.file) {
        // In Electron, File objects have a path property
        const data = await window.electronAPI.file.readCSV((file as any).path);
        const parsedData = data.map((row: any) => ({
          address: row.address || row.Address || row.地址,
          amount: row.amount || row.Amount || row.金额 || '0'
        })).filter((item: Recipient) => item.address && item.amount);

        setRecipients(parsedData);

        const total = parsedData.reduce((sum: number, item: Recipient) =>
          sum + parseFloat(item.amount || '0'), 0);
        setTotalAmount(total.toString());
      }
    } catch (error) {
      console.error('导入CSV失败:', error);
      alert('CSV导入失败，请检查文件格式');
    }
  };

  const checkApproval = async () => {
    if (!campaign?.chain || !campaign?.tokenAddress || !campaign?.contractAddress || !totalAmount) return;

    try {
      const chainService = await window.electronAPI?.chain.getEVMChains(true);
      const chain = chainService?.find((c: any) => c.chainId === parseInt(campaign.chain));

      if (chain && window.electronAPI?.contract) {
        const result = await window.electronAPI.contract.checkApproval(
          chain.rpcUrl,
          '', // will use campaign wallet
          campaign.tokenAddress,
          campaign.contractAddress,
          totalAmount
        );
        setApprovedAmount(result.approved ? totalAmount : '0');
      }
    } catch (error) {
      console.error('检查授权失败:', error);
    }
  };

  const approveTokens = async () => {
    if (!campaign?.chain || !campaign?.tokenAddress || !campaign?.contractAddress || !totalAmount) {
      alert('缺少必要信息');
      return;
    }

    setLoading(true);
    try {
      const chainService = await window.electronAPI?.chain.getEVMChains(true);
      const chain = chainService?.find((c: any) => c.chainId === parseInt(campaign.chain));

      if (chain && window.electronAPI?.contract) {
        const result = await window.electronAPI.contract.approveTokens(
          chain.rpcUrl,
          '', // will use campaign wallet
          campaign.tokenAddress,
          campaign.contractAddress,
          totalAmount
        );

        if (result.success) {
          alert('代币授权成功！');
          setApprovedAmount(totalAmount);
        } else {
          alert('授权失败');
        }
      }
    } catch (error) {
      console.error('授权失败:', error);
      alert(`授权失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const executeBatchTransfer = async () => {
    if (recipients.length === 0) {
      alert('请先导入收币地址');
      return;
    }

    if (!campaign?.chain || !campaign?.tokenAddress || !campaign?.contractAddress) {
      alert('缺少必要信息');
      return;
    }

    setSending(true);
    setProgress({ current: 0, total: recipients.length });

    try {
      const chainService = await window.electronAPI?.chain.getEVMChains(true);
      const chain = chainService?.find((c: any) => c.chainId === parseInt(campaign.chain));

      if (chain && window.electronAPI?.contract) {
        const addresses = recipients.map(r => r.address);
        const amounts = recipients.map(r => r.amount);

        const result = await window.electronAPI.contract.batchTransfer(
          campaign.contractAddress,
          chain.rpcUrl,
          '', // will use campaign wallet
          addresses,
          amounts,
          campaign.tokenAddress
        );

        if (result.success) {
          alert(`批量转账成功！\n交易哈希: ${result.data.transactionHash}\n转账金额: ${result.data.totalAmount}\nGas消耗: ${result.data.gasUsed}`);
          setRecipients(prev => prev.map((r, i) => ({
            ...r,
            status: 'sent',
            txHash: result.data.transactionHash
          })));
          setProgress({ current: recipients.length, total: recipients.length });
        } else {
          alert('批量转账失败');
        }
      }
    } catch (error) {
      console.error('批量转账失败:', error);
      alert(`批量转账失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-400';
      case 'SENDING': return 'text-yellow-400';
      case 'FAILED': return 'text-red-400';
      case 'PAUSED': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'CREATED': return '已创建 (待充值)';
      case 'FUNDED': return '已充值 (待部署合约)';
      case 'READY': return '就绪';
      case 'SENDING': return '发送中';
      case 'PAUSED': return '已暂停';
      case 'COMPLETED': return '已完成';
      case 'FAILED': return '失败';
      default: return '未知';
    }
  };

  const deployContract = async () => {
    if (!id) {
      alert('活动ID缺失');
      return;
    }

    if (!hasEnoughGas()) {
      alert(
        `Gas余额不足\n\n` +
        `当前余额: ${gasBalance} ${chainSymbol}\n` +
        `最少需要: ${MIN_GAS_FOR_DEPLOYMENT} ${chainSymbol}\n\n` +
        `请先充值足够的Gas费后重试`
      );
      return;
    }

    // 防止重复点击
    if (deployingContract) {
      alert('部署正在进行中，请勿重复点击');
      return;
    }

    setDeployingContract(true);
    try {
      if (window.electronAPI?.campaign) {
        const result = await window.electronAPI.campaign.deployContract(id);

        if (result.success) {
          // 启动状态轮询
          pollCampaignStatus();

          alert(
            `合约部署成功！\n\n` +
            `📋 合约地址: ${result.contractAddress}\n` +
            `🔗 交易哈希: ${result.transactionHash}\n` +
            `⛽ Gas消耗: ${result.gasUsed}\n\n` +
            `现在可以导入CSV并开始发放代币了！`
          );
        }
      }
    } catch (error) {
      console.error('部署合约失败:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';

      // 更友好的错误提示
      if (errorMsg.includes('already in progress')) {
        alert('合约正在部署中，请稍候');
      } else if (errorMsg.includes('already deployed')) {
        alert('合约已经部署，无需重复部署');
      } else if (errorMsg.includes('Cannot deploy contract from status')) {
        alert(`当前状态不允许部署合约\n\n${errorMsg}`);
      } else {
        alert(`合约部署失败: ${errorMsg}`);
      }
    } finally {
      setDeployingContract(false);
    }
  };

  /**
   * 轮询活动状态直到合约部署完成
   */
  const pollCampaignStatus = () => {
    let pollCount = 0;
    const maxPolls = 20; // 最多轮询20次（60秒）

    const interval = setInterval(async () => {
      pollCount++;

      try {
        if (window.electronAPI?.campaign && id) {
          const updated = await window.electronAPI.campaign.getById(id);
          if (updated?.contractAddress) {
            // 合约已部署，更新状态并停止轮询
            setCampaign(updated);
            clearInterval(interval);
            await loadTokenBalance(); // 刷新余额
          }
        }

        // 超时停止
        if (pollCount >= maxPolls) {
          clearInterval(interval);
        }
      } catch (error) {
        console.error('轮询状态失败:', error);
      }
    }, 3000); // 每3秒检查一次
  };

  if (!campaign) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 relative overflow-hidden rounded-3xl bg-cryptocast-gradient p-8 md:p-12 shadow-cryptocast-xl cryptocast-glow-purple">
          <div className="absolute inset-0 bg-cryptocast-gradient-shimmer opacity-20"></div>
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-bold text-cryptocast-white cryptocast-shimmer mb-4">活动详情</h1>
            <div className="flex items-center gap-3 text-cryptocast-white/90">
              <div className="w-8 h-8 border-3 border-cryptocast-white/30 border-t-cryptocast-white rounded-full animate-spin"></div>
              <span className="text-lg font-medium">加载中...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Enhanced Header */}
      <div className="mb-8 relative overflow-hidden rounded-3xl bg-cryptocast-gradient p-8 md:p-12 shadow-cryptocast-xl cryptocast-glow-purple">
        <div className="absolute inset-0 bg-cryptocast-gradient-shimmer opacity-20"></div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 text-cryptocast-white cryptocast-shimmer">{campaign.name}</h1>
              <div className="flex items-center gap-4">
                <div className={`glass px-4 py-2 rounded-xl font-bold text-sm ${getStatusColor(campaign.status)}`}>
                  {getStatusText(campaign.status)}
                </div>
                <div className="glass px-4 py-2 rounded-xl flex items-center gap-2 text-cryptocast-white">
                  <span className="text-lg">📍</span>
                  <span className="text-sm font-medium">Chain {campaign.chain}</span>
                </div>
                <div className="glass px-4 py-2 rounded-xl flex items-center gap-2 text-cryptocast-white">
                  <span className="text-lg">📅</span>
                  <span className="text-sm font-medium">{new Date(campaign.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="glass hover:bg-cryptocast-bg-card-hover transition-cryptocast px-6 py-3 rounded-2xl border border-cryptocast-glass-border text-lg font-medium text-cryptocast-white hover:text-cryptocast-cyan flex items-center gap-3"
            >
              <span className="text-xl">←</span>
              返回列表
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Campaign Info */}
      <div className="card-cryptocast p-8 mb-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center cryptocast-glow">
            <span className="text-2xl">📋</span>
          </div>
          <h2 className="text-2xl font-bold text-cryptocast-white">活动信息</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="glass p-4 rounded-xl">
            <div className="text-cryptocast-muted text-sm mb-2">状态</div>
            <div className={`font-bold text-lg ${getStatusColor(campaign.status)}`}>
              {getStatusText(campaign.status)}
            </div>
          </div>
          <div className="glass p-4 rounded-xl">
            <div className="text-cryptocast-muted text-sm mb-2">区块链</div>
            <div className="font-mono text-cryptocast-white font-medium">Chain {campaign.chain}</div>
          </div>
          <div className="glass p-4 rounded-xl">
            <div className="text-cryptocast-muted text-sm mb-2">代币地址</div>
            <div className="font-mono text-cryptocast-cyan text-sm break-all">{campaign.tokenAddress}</div>
          </div>
          <div className="glass p-4 rounded-xl">
            <div className="text-cryptocast-muted text-sm mb-2">合约地址</div>
            <div className="font-mono text-sm break-all">
              {campaign.contractAddress ? (
                <span className="text-cryptocast-green-bright">{campaign.contractAddress}</span>
              ) : (
                <span className="text-cryptocast-muted">未部署</span>
              )}
            </div>
          </div>
          <div className="glass p-4 rounded-xl">
            <div className="text-cryptocast-muted text-sm mb-2">发奖地址</div>
            <div className="font-mono text-sm break-all">
              {campaign.walletAddress ? (
                <span className="text-cryptocast-cyan">{campaign.walletAddress}</span>
              ) : (
                <span className="text-cryptocast-muted">未创建</span>
              )}
            </div>
          </div>
          <div className="glass p-4 rounded-xl">
            <div className="text-cryptocast-muted text-sm mb-2">创建时间</div>
            <div className="text-cryptocast-white font-medium">{new Date(campaign.createdAt).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Enhanced Contract Deployment Section */}
      {(campaign.status === 'CREATED' || campaign.status === 'FUNDED') && !campaign.contractAddress && (
        <div className="card-cryptocast p-8 mb-8 cryptocast-glow-warning border-l-4 border-cryptocast-warning">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center cryptocast-float">
              <span className="text-2xl">🚀</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-cryptocast-white">部署批量转账合约</h2>
              <p className="text-cryptocast-warning-light text-sm mt-1">智能合约部署向导</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="glass p-6 rounded-2xl border-l-4 border-cryptocast-cyan">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl glass flex items-center justify-center cryptocast-glow-cyan">
                  <span className="text-xl">💡</span>
                </div>
                <h3 className="text-lg font-bold text-cryptocast-white">部署前准备</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-cryptocast-secondary">
                  <span className="text-cryptocast-cyan font-bold text-lg mt-0.5">1️⃣</span>
                  <div>
                    <p className="text-sm">向活动专用地址充值足够的 Gas 费</p>
                    <p className="font-mono text-xs text-cryptocast-cyan break-all mt-1">{campaign.walletAddress}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-cryptocast-secondary">
                  <span className="text-cryptocast-cyan font-bold text-lg mt-0.5">2️⃣</span>
                  <div>
                    <p className="text-sm">当前 Gas 余额</p>
                    <p className="font-bold text-cryptocast-white">{gasBalance} {chainSymbol}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-cryptocast-secondary">
                  <span className="text-cryptocast-cyan font-bold text-lg mt-0.5">3️⃣</span>
                  <div>
                    <p className="text-sm">最少需要</p>
                    <p className="font-bold text-cryptocast-warning-light">{MIN_GAS_FOR_DEPLOYMENT} {chainSymbol}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-cryptocast-secondary">
                  <span className="text-cryptocast-cyan font-bold text-lg mt-0.5">4️⃣</span>
                  <p className="text-sm">点击"部署合约"按钮开始部署</p>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              {!hasEnoughGas() && (
                <div className="glass p-6 rounded-2xl border-l-4 border-cryptocast-error bg-cryptocast-error/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl glass flex items-center justify-center cryptocast-glow-error">
                      <span className="text-xl">⚠️</span>
                    </div>
                    <h3 className="text-lg font-bold text-cryptocast-error-light">Gas 余额不足</h3>
                  </div>
                  <p className="text-cryptocast-secondary text-sm mb-2">
                    当前余额: <span className="font-bold text-cryptocast-error-light">{gasBalance} {chainSymbol}</span>
                  </p>
                  <p className="text-cryptocast-secondary text-sm mb-2">
                    最少需要: <span className="font-bold text-cryptocast-warning-light">{MIN_GAS_FOR_DEPLOYMENT} {chainSymbol}</span>
                  </p>
                  <p className="text-cryptocast-muted text-xs">
                    请先向活动专用地址充值 Gas 费，然后刷新页面查看余额
                  </p>
                </div>
              )}

              {deployingContract && (
                <div className="glass p-6 rounded-2xl border-l-4 border-cryptocast-warning cryptocast-glow-warning">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl glass flex items-center justify-center">
                      <div className="animate-spin w-6 h-6 border-2 border-cryptocast-white/30 border-t-cryptocast-white rounded-full"></div>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-cryptocast-white">正在部署合约</h3>
                      <p className="text-cryptocast-warning-light text-sm">预计需要 30-60 秒</p>
                    </div>
                  </div>
                  <p className="text-cryptocast-muted text-xs">
                    💡 请勿关闭页面，部署完成后会自动刷新状态
                  </p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={deployContract}
            disabled={deployingContract || !hasEnoughGas()}
            className="btn-cryptocast shadow-glow-green hover:shadow-glow-cyan w-full text-lg px-8 py-5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none font-bold"
          >
            {deployingContract ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-6 h-6 border-3 border-cryptocast-white/30 border-t-cryptocast-white rounded-full animate-spin"></div>
                <span>部署中...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">🚀</span>
                <span>部署合约</span>
              </div>
            )}
          </button>
        </div>
      )}

      {/* Enhanced Contract Deployed Section */}
      {campaign.contractAddress && campaign.contractDeployedAt && (
        <div className="card-cryptocast p-8 mb-8 cryptocast-glow-green border-l-4 border-cryptocast-green">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center cryptocast-float">
              <span className="text-2xl">✅</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-cryptocast-white">合约已部署</h2>
              <p className="text-cryptocast-green-bright text-sm mt-1">智能合约部署成功</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass p-6 rounded-2xl">
              <div className="text-cryptocast-muted text-sm mb-2">合约地址</div>
              <div className="font-mono text-cryptocast-green-bright text-sm break-all">{campaign.contractAddress}</div>
            </div>
            <div className="glass p-6 rounded-2xl">
              <div className="text-cryptocast-muted text-sm mb-2">部署时间</div>
              <div className="text-cryptocast-white font-medium">{new Date(campaign.contractDeployedAt).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {campaign.status === 'READY' && (
        <>
          {/* Enhanced Token Info */}
          <div className="card-cryptocast p-8 mb-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center cryptocast-glow-cyan">
                <span className="text-2xl">💰</span>
              </div>
              <h2 className="text-2xl font-bold text-cryptocast-white">代币信息</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass p-6 rounded-2xl text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl glass flex items-center justify-center cryptocast-float">
                  <span className="text-2xl">🏷️</span>
                </div>
                <div className="text-cryptocast-muted text-sm mb-2">代币名称</div>
                <div className="text-cryptocast-white font-bold text-lg">{tokenInfo?.name || '加载中...'}</div>
              </div>
              <div className="glass p-6 rounded-2xl text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl glass flex items-center justify-center cryptocast-float">
                  <span className="text-2xl">🎯</span>
                </div>
                <div className="text-cryptocast-muted text-sm mb-2">代币符号</div>
                <div className="text-cryptocast-cyan font-bold text-lg">{tokenInfo?.symbol || '加载中...'}</div>
              </div>
              <div className="glass p-6 rounded-2xl text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl glass flex items-center justify-center cryptocast-float">
                  <span className="text-2xl">💳</span>
                </div>
                <div className="text-cryptocast-muted text-sm mb-2">钱包余额</div>
                <div className="text-cryptocast-green font-bold text-lg">{tokenBalance} {tokenInfo?.symbol}</div>
              </div>
            </div>
          </div>

          {/* Enhanced CSV Import */}
          <div className="card-cryptocast p-8 mb-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center cryptocast-glow">
                <span className="text-2xl">📋</span>
              </div>
              <h2 className="text-2xl font-bold text-cryptocast-white">导入收币地址</h2>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-cryptocast-secondary mb-3">
                  选择CSV文件 (格式: address, amount)
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={importCSV}
                  className="w-full px-4 py-4 glass border border-cryptocast-glass-border rounded-2xl text-cryptocast-white file:mr-4 file:py-2 file:px-4 file:rounded-2xl file:border-0 file:text-sm file:font-semibold file:bg-cryptocast-gradient file:text-cryptocast-white hover:file:bg-cryptocast-gradient-accent focus:outline-none focus:ring-2 focus:ring-cryptocast-purple focus:border-cryptocast-purple transition-cryptocast"
                />
              </div>

              {recipients.length > 0 && (
                <div className="glass p-6 rounded-2xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-cryptocast-white">导入详情</h3>
                    <div className="flex gap-4">
                      <div className="glass px-4 py-2 rounded-xl">
                        <span className="text-cryptocast-muted text-sm">地址数量</span>
                        <span className="ml-2 font-bold text-cryptocast-cyan">{recipients.length}</span>
                      </div>
                      <div className="glass px-4 py-2 rounded-xl">
                        <span className="text-cryptocast-muted text-sm">总金额</span>
                        <span className="ml-2 font-bold text-cryptocast-green">{totalAmount} {tokenInfo?.symbol}</span>
                      </div>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto scrollbar-cryptocast rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-cryptocast-glass-border">
                          <th className="pb-3 text-cryptocast-muted text-left font-bold">#</th>
                          <th className="pb-3 text-cryptocast-muted text-left font-bold">地址</th>
                          <th className="pb-3 text-cryptocast-muted text-right font-bold">金额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipients.slice(0, 20).map((recipient, index) => (
                          <tr key={index} className="border-b border-cryptocast-glass-border/50 hover:bg-cryptocast-bg-card-hover transition-colors">
                            <td className="py-3 text-cryptocast-secondary">{index + 1}</td>
                            <td className="py-3 font-mono text-cryptocast-cyan text-xs">{recipient.address}</td>
                            <td className="py-3 text-cryptocast-white text-right font-medium">{recipient.amount}</td>
                          </tr>
                        ))}
                        {recipients.length > 20 && (
                          <tr>
                            <td colSpan={3} className="py-3 text-center text-cryptocast-muted">
                              ... 还有 {recipients.length - 20} 个地址
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Token Approval */}
          <div className="card-cryptocast p-8 mb-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center cryptocast-glow-warning">
                <span className="text-2xl">🔑</span>
              </div>
              <h2 className="text-2xl font-bold text-cryptocast-white">代币授权</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="glass p-6 rounded-2xl">
                <div className="text-cryptocast-muted text-sm mb-2">需要授权金额</div>
                <div className="text-cryptocast-warning font-bold text-2xl">{totalAmount} {tokenInfo?.symbol}</div>
              </div>
              <div className="glass p-6 rounded-2xl">
                <div className="text-cryptocast-muted text-sm mb-2">已授权金额</div>
                <div className="text-cryptocast-cyan font-bold text-2xl">{approvedAmount} {tokenInfo?.symbol}</div>
              </div>
            </div>

            {parseFloat(approvedAmount) < parseFloat(totalAmount) && (
              <button
                onClick={approveTokens}
                disabled={loading}
                className="btn-cryptocast shadow-glow-warning hover:shadow-glow-green w-full text-lg px-8 py-5 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-6 h-6 border-3 border-cryptocast-white/30 border-t-cryptocast-white rounded-full animate-spin"></div>
                    <span>授权中...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl">🔑</span>
                    <span>授权代币</span>
                  </div>
                )}
              </button>
            )}

            {parseFloat(approvedAmount) >= parseFloat(totalAmount) && (
              <div className="glass p-6 rounded-2xl border-l-4 border-cryptocast-green cryptocast-glow-green">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl glass flex items-center justify-center cryptocast-float">
                    <span className="text-xl">✅</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-cryptocast-green-bright">代币已授权</h3>
                    <p className="text-cryptocast-secondary text-sm">可以开始执行批量发奖</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Batch Transfer Execution */}
          {recipients.length > 0 && parseFloat(approvedAmount) >= parseFloat(totalAmount) && (
            <div className="card-cryptocast p-8 mb-8 cryptocast-glow-purple border-l-4 border-cryptocast-purple">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center cryptocast-float">
                  <span className="text-2xl">🚀</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-cryptocast-white">执行批量发奖</h2>
                  <p className="text-cryptocast-purple text-sm mt-1">智能合约批量转账</p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="glass p-6 rounded-2xl text-center">
                  <div className="text-cryptocast-muted text-sm mb-2">待处理地址数量</div>
                  <div className="text-cryptocast-white font-bold text-4xl mb-2">{recipients.length}</div>
                  <div className="text-cryptocast-secondary">总金额: {totalAmount} {tokenInfo?.symbol}</div>
                </div>

                <button
                  onClick={executeBatchTransfer}
                  disabled={sending}
                  className="btn-cryptocast shadow-glow-purple hover:shadow-glow-cyan w-full text-lg px-8 py-5 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                >
                  {sending ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-6 h-6 border-3 border-cryptocast-white/30 border-t-cryptocast-white rounded-full animate-spin"></div>
                      <span>发奖中...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-2xl">🎉</span>
                      <span>开始发奖 ({recipients.length} 个地址)</span>
                    </div>
                  )}
                </button>

                {sending && (
                  <div className="glass p-6 rounded-2xl">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-cryptocast-secondary font-medium">发奖进度</span>
                      <span className="text-cryptocast-cyan font-bold">{progress.current} / {progress.total}</span>
                    </div>
                    <div className="w-full bg-cryptocast-bg-tertiary rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cryptocast-cyan to-cryptocast-green rounded-full cryptocast-shimmer transition-all duration-500"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      ></div>
                    </div>
                    <div className="text-center mt-2 text-cryptocast-muted text-sm">
                      {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}% 完成
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Enhanced Distribution Results */}
          {recipients.some(r => r.status) && (
            <div className="card-cryptocast p-8 cryptocast-glow-cyan">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center cryptocast-float">
                  <span className="text-2xl">📊</span>
                </div>
                <h2 className="text-2xl font-bold text-cryptocast-white">发奖结果</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass p-6 rounded-2xl text-center cryptocast-glow-green">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl glass flex items-center justify-center cryptocast-float">
                    <span className="text-3xl">✅</span>
                  </div>
                  <div className="text-cryptocast-green-bright font-bold text-3xl mb-2">
                    {recipients.filter(r => r.status === 'sent').length}
                  </div>
                  <div className="text-cryptocast-secondary font-medium">成功</div>
                </div>
                <div className="glass p-6 rounded-2xl text-center cryptocast-glow-error">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl glass flex items-center justify-center cryptocast-float">
                    <span className="text-3xl">❌</span>
                  </div>
                  <div className="text-cryptocast-error-light font-bold text-3xl mb-2">
                    {recipients.filter(r => r.status === 'failed').length}
                  </div>
                  <div className="text-cryptocast-secondary font-medium">失败</div>
                </div>
                <div className="glass p-6 rounded-2xl text-center cryptocast-glow-warning">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl glass flex items-center justify-center cryptocast-float">
                    <span className="text-3xl">⏳</span>
                  </div>
                  <div className="text-cryptocast-warning-light font-bold text-3xl mb-2">
                    {recipients.filter(r => r.status === 'pending').length}
                  </div>
                  <div className="text-cryptocast-secondary font-medium">待处理</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
