import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

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
  const [walletUnlocked, setWalletUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [tokenInfo, setTokenInfo] = useState<{ symbol: string; name: string; decimals: number } | null>(null);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [totalAmount, setTotalAmount] = useState('0');
  const [approvedAmount, setApprovedAmount] = useState('0');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [csvFile, setCsvFile] = useState<File | null>(null);

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
      }
    } catch (error) {
      console.error('加载代币余额失败:', error);
    }
  };

  useEffect(() => {
    if (campaign) {
      loadTokenInfo();
      loadTokenBalance();
    }
  }, [campaign]);

  const unlockWallet = async () => {
    if (!password) {
      alert('请输入密码');
      return;
    }

    setLoading(true);
    try {
      if (window.electronAPI?.wallet) {
        const result = await window.electronAPI.wallet.unlock(password);
        setWalletUnlocked(result.success);
        if (!result.success) {
          alert('密码错误');
        }
      }
    } catch (error) {
      console.error('解锁钱包失败:', error);
      alert('解锁失败');
    } finally {
      setLoading(false);
    }
  };

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

    if (!walletUnlocked) {
      alert('请先解锁钱包');
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
    if (!walletUnlocked) {
      alert('请先解锁钱包');
      return;
    }

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
      case 'CREATED': return '已创建';
      case 'READY': return '就绪';
      case 'SENDING': return '发送中';
      case 'PAUSED': return '已暂停';
      case 'COMPLETED': return '已完成';
      case 'FAILED': return '失败';
      default: return '未知';
    }
  };

  if (!campaign) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">活动详情</h1>
        <div className="bg-gray-800 p-6 rounded-lg">
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{campaign.name}</h1>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
        >
          返回列表
        </button>
      </div>

      {/* 活动信息 */}
      <div className="bg-gray-800 p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">活动信息</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-gray-400">状态:</span>
            <span className={`ml-2 ${getStatusColor(campaign.status)}`}>
              {getStatusText(campaign.status)}
            </span>
          </div>
          <div>
            <span className="text-gray-400">区块链:</span>
            <span className="ml-2">{campaign.chain}</span>
          </div>
          <div>
            <span className="text-gray-400">代币地址:</span>
            <span className="ml-2 font-mono text-sm">{campaign.tokenAddress}</span>
          </div>
          <div>
            <span className="text-gray-400">合约地址:</span>
            <span className="ml-2 font-mono text-sm">{campaign.contractAddress || '未部署'}</span>
          </div>
          <div>
            <span className="text-gray-400">发奖地址:</span>
            <span className="ml-2 font-mono text-sm">{campaign.walletAddress || '未创建'}</span>
          </div>
          <div>
            <span className="text-gray-400">创建时间:</span>
            <span className="ml-2">{new Date(campaign.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 钱包解锁 */}
      {!walletUnlocked && (
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">🔐 钱包解锁</h2>
          <div className="flex space-x-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="输入钱包密码"
            />
            <button
              onClick={unlockWallet}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '解锁中...' : '解锁钱包'}
            </button>
          </div>
        </div>
      )}

      {walletUnlocked && (
        <>
          {/* 代币信息 */}
          <div className="bg-gray-800 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">💰 代币信息</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-gray-400">代币名称:</span>
                <span className="ml-2">{tokenInfo?.name || '加载中...'}</span>
              </div>
              <div>
                <span className="text-gray-400">代币符号:</span>
                <span className="ml-2">{tokenInfo?.symbol || '加载中...'}</span>
              </div>
              <div>
                <span className="text-gray-400">钱包余额:</span>
                <span className="ml-2">{tokenBalance} {tokenInfo?.symbol}</span>
              </div>
            </div>
          </div>

          {/* CSV导入 */}
          <div className="bg-gray-800 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">📋 导入收币地址</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  选择CSV文件 (格式: address, amount)
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={importCSV}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {recipients.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">
                    已导入 {recipients.length} 个地址，总金额: {totalAmount} {tokenInfo?.symbol}
                  </p>
                  <div className="max-h-40 overflow-y-auto bg-gray-700 rounded p-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400">
                          <th className="pb-1">#</th>
                          <th className="pb-1">地址</th>
                          <th className="pb-1">金额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipients.slice(0, 10).map((recipient, index) => (
                          <tr key={index} className="text-gray-300">
                            <td className="py-1">{index + 1}</td>
                            <td className="py-1 font-mono text-xs">{recipient.address}</td>
                            <td className="py-1">{recipient.amount}</td>
                          </tr>
                        ))}
                        {recipients.length > 10 && (
                          <tr>
                            <td colSpan={3} className="py-1 text-center text-gray-500">
                              ... 还有 {recipients.length - 10} 个地址
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

          {/* 代币授权 */}
          <div className="bg-gray-800 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">🔑 代币授权</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">
                  需要授权金额: {totalAmount} {tokenInfo?.symbol}
                </p>
                <p className="text-sm text-gray-400 mb-2">
                  已授权金额: {approvedAmount} {tokenInfo?.symbol}
                </p>
              </div>

              {parseFloat(approvedAmount) < parseFloat(totalAmount) && (
                <button
                  onClick={approveTokens}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? '授权中...' : '授权代币'}
                </button>
              )}

              {parseFloat(approvedAmount) >= parseFloat(totalAmount) && (
                <div className="p-2 bg-green-900 border border-green-700 rounded text-sm">
                  ✅ 代币已授权
                </div>
              )}
            </div>
          </div>

          {/* 执行发奖 */}
          {recipients.length > 0 && parseFloat(approvedAmount) >= parseFloat(totalAmount) && (
            <div className="bg-gray-800 p-6 rounded-lg mb-6">
              <h2 className="text-xl font-semibold mb-4">🚀 执行批量发奖</h2>
              <div className="space-y-4">
                <button
                  onClick={executeBatchTransfer}
                  disabled={sending}
                  className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-lg font-semibold"
                >
                  {sending ? '发奖中...' : `开始发奖 (${recipients.length} 个地址)`}
                </button>

                {sending && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>发奖进度:</span>
                      <span>{progress.current} / {progress.total}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 发奖结果 */}
          {recipients.some(r => r.status) && (
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">📊 发奖结果</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {recipients.filter(r => r.status === 'sent').length}
                  </div>
                  <div className="text-sm text-gray-400">成功</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">
                    {recipients.filter(r => r.status === 'failed').length}
                  </div>
                  <div className="text-sm text-gray-400">失败</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {recipients.filter(r => r.status === 'pending').length}
                  </div>
                  <div className="text-sm text-gray-400">待处理</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
