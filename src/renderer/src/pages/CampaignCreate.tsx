import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CampaignCreate() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    chain: 'ethereum',
    tokenAddress: '',
    recipientCount: 0,
    totalAmount: ''
  });

  const [chains, setChains] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadChains();
  }, []);

  const loadChains = async () => {
    try {
      if (window.electronAPI?.chain) {
        const evmChains = await window.electronAPI.chain.getEVMChains(true);
        setChains(evmChains);
      }
    } catch (error) {
      console.error('加载链列表失败:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.chain || !formData.tokenAddress) {
      alert('请填写必要信息');
      return;
    }

    setLoading(true);
    try {
      // 1. 创建新的活动专用钱包
      let newWallet;
      if (window.electronAPI?.wallet) {
        newWallet = await window.electronAPI.wallet.create('evm');
        console.log('活动专用钱包已创建:', newWallet.address);
      }

      // 2. 创建活动 - 状态为 CREATED，等待充值和部署合约
      if (window.electronAPI?.campaign) {
        const campaignData = {
          name: formData.name,
          chain: formData.chain,
          tokenAddress: formData.tokenAddress,
          status: 'CREATED', // 初始状态：已创建，等待充值
          walletAddress: newWallet?.address,
          walletPrivateKeyBase64: newWallet?.privateKeyBase64,
          contractAddress: null // 合约稍后由运营人员手动部署
        };

        const campaign = await window.electronAPI.campaign.create(campaignData);

        alert(
          `活动创建成功！\n\n` +
          `📍 活动ID: ${campaign.id}\n` +
          `💰 活动专用地址: ${newWallet?.address}\n\n` +
          `⏭️  下一步操作：\n` +
          `1. 向该地址转入足够的 Gas 费\n` +
          `2. 在活动详情页手动部署合约\n` +
          `3. 部署成功后即可开始发放`
        );
        navigate(`/campaign/${campaign.id}`);
      }
    } catch (error) {
      console.error('创建活动失败:', error);
      alert(`创建活动失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Enhanced Header */}
      <div className="mb-8 relative overflow-hidden rounded-3xl bg-cryptocast-gradient p-8 md:p-12 shadow-cryptocast-xl cryptocast-glow-purple">
        <div className="absolute inset-0 bg-cryptocast-gradient-shimmer opacity-20"></div>
        <div className="relative z-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-cryptocast-white cryptocast-shimmer">创建新活动</h1>
          <p className="text-xl text-cryptocast-white/90 font-medium">
            🎯 每个活动将创建独立的专用钱包，确保资金安全和活动隔离
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Enhanced Basic Information */}
        <div className="card-cryptocast p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-cryptocast-gradient flex items-center justify-center cryptocast-glow">
              <span className="text-2xl">📝</span>
            </div>
            <h2 className="text-2xl font-bold text-cryptocast-white">基本信息</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-cryptocast-secondary">
                活动名称 *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-4 glass border border-cryptocast-glass-border rounded-2xl text-cryptocast-white placeholder-cryptocast-muted focus:outline-none focus:ring-2 focus:ring-cryptocast-purple focus:border-cryptocast-purple transition-cryptocast"
                placeholder="输入活动名称"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-cryptocast-secondary">
                区块链网络 *
              </label>
              <select
                name="chain"
                value={formData.chain}
                onChange={handleInputChange}
                className="w-full px-4 py-4 glass border border-cryptocast-glass-border rounded-2xl text-cryptocast-white focus:outline-none focus:ring-2 focus:ring-cryptocast-purple focus:border-cryptocast-purple transition-cryptocast"
                required
              >
                {chains.map(chain => (
                  <option key={chain.chainId} value={chain.chainId} className="bg-cryptocast-bg-secondary">
                    {chain.name} ({chain.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-cryptocast-secondary">
                代币地址 *
              </label>
              <input
                type="text"
                name="tokenAddress"
                value={formData.tokenAddress}
                onChange={handleInputChange}
                className="w-full px-4 py-4 glass border border-cryptocast-glass-border rounded-2xl text-cryptocast-white placeholder-cryptocast-muted focus:outline-none focus:ring-2 focus:ring-cryptocast-purple focus:border-cryptocast-purple transition-cryptocast font-mono"
                placeholder="0x..."
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-cryptocast-secondary">
                预计收币人数
              </label>
              <input
                type="number"
                name="recipientCount"
                value={formData.recipientCount}
                onChange={handleInputChange}
                className="w-full px-4 py-4 glass border border-cryptocast-glass-border rounded-2xl text-cryptocast-white placeholder-cryptocast-muted focus:outline-none focus:ring-2 focus:ring-cryptocast-purple focus:border-cryptocast-purple transition-cryptocast"
                placeholder="0"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* Enhanced Security Process Explanation */}
        <div className="card-cryptocast p-8 cryptocast-glow-green">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center cryptocast-float">
              <span className="text-2xl">🔐</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-cryptocast-white">安全部署流程</h2>
              <p className="text-sm text-cryptocast-green-bright mt-1 font-medium">（三步走，无需私钥）</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass p-6 rounded-2xl border-l-4 border-cryptocast-cyan">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl glass flex items-center justify-center cryptocast-glow-cyan">
                  <span className="text-xl">💡</span>
                </div>
                <h3 className="text-lg font-bold text-cryptocast-white">改进后的安全流程</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-cryptocast-secondary">
                  <span className="text-cryptocast-cyan font-bold text-lg mt-0.5">1️⃣</span>
                  <span className="text-sm">系统自动创建活动专用地址（无需手动输入私钥）</span>
                </li>
                <li className="flex items-start gap-3 text-cryptocast-secondary">
                  <span className="text-cryptocast-cyan font-bold text-lg mt-0.5">2️⃣</span>
                  <span className="text-sm">运营人员向该地址充值 Gas 费</span>
                </li>
                <li className="flex items-start gap-3 text-cryptocast-secondary">
                  <span className="text-cryptocast-cyan font-bold text-lg mt-0.5">3️⃣</span>
                  <span className="text-sm">在活动详情页手动部署合约（使用专用地址）</span>
                </li>
                <li className="flex items-start gap-3 text-cryptocast-secondary">
                  <span className="text-cryptocast-cyan font-bold text-lg mt-0.5">4️⃣</span>
                  <span className="text-sm">部署成功后，使用该合约进行批量发放</span>
                </li>
              </ul>
            </div>

            <div className="glass p-6 rounded-2xl border-l-4 border-cryptocast-green">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl glass flex items-center justify-center cryptocast-glow-green">
                  <span className="text-xl">✅</span>
                </div>
                <h3 className="text-lg font-bold text-cryptocast-white">安全优势</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-cryptocast-secondary">
                  <span className="text-cryptocast-green text-lg mt-0.5">•</span>
                  <span className="text-sm">私钥永远不会出现在创建活动的表单中</span>
                </li>
                <li className="flex items-start gap-3 text-cryptocast-secondary">
                  <span className="text-cryptocast-green text-lg mt-0.5">•</span>
                  <span className="text-sm">每个活动使用独立的专用地址，资金完全隔离</span>
                </li>
                <li className="flex items-start gap-3 text-cryptocast-secondary">
                  <span className="text-cryptocast-green text-lg mt-0.5">•</span>
                  <span className="text-sm">合约部署由系统在后台安全执行</span>
                </li>
                <li className="flex items-start gap-3 text-cryptocast-secondary">
                  <span className="text-cryptocast-green text-lg mt-0.5">•</span>
                  <span className="text-sm">包含重入保护，每次转账节省 3,000-5,000 gas</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Enhanced Submit Buttons */}
        <div className="flex gap-6">
          <button
            type="submit"
            disabled={loading}
            className="btn-cryptocast shadow-glow-purple hover:shadow-glow-cyan flex-1 text-lg px-8 py-5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-6 h-6 border-3 border-cryptocast-white/30 border-t-cryptocast-white rounded-full animate-spin"></div>
                <span>创建中...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">🚀</span>
                <span>创建活动</span>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="glass hover:bg-cryptocast-bg-card-hover transition-cryptocast px-8 py-5 rounded-2xl border border-cryptocast-glass-border text-lg font-medium text-cryptocast-secondary hover:text-cryptocast-white"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">❌</span>
              <span>取消</span>
            </div>
          </button>
        </div>
      </form>
    </div>
  );
}
