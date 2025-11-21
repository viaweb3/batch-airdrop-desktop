import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaign } from '../contexts/CampaignContext';
import { Campaign, CSVValidationResult } from '../types';

interface CampaignFormData {
  name: string;
  description: string;
  chain: string;
  tokenAddress: string;
  batchSize: number;
  sendInterval: string;
}

export default function CampaignCreate() {
  const navigate = useNavigate();
  const { state, actions } = useCampaign();
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    description: '',
    chain: '137', // Default to Polygon
    tokenAddress: '',
    batchSize: 50,
    sendInterval: '15000' // Default to 15 seconds
  });
  const [csvContent, setCsvContent] = useState<string>('');
  const [csvValidation, setCsvValidation] = useState<CSVValidationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [tokenAddressError, setTokenAddressError] = useState<string>('');
  const [estimation, setEstimation] = useState<any>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  const availableChains = [
    { id: '1', name: 'Ethereum', symbol: 'ETH' },
    { id: '137', name: 'Polygon', symbol: 'POL' },
    { id: '42161', name: 'Arbitrum', symbol: 'ETH' },
    { id: '10', name: 'Optimism', symbol: 'ETH' },
    { id: '8453', name: 'Base', symbol: 'ETH' },
    { id: '56', name: 'BSC', symbol: 'BNB' },
  ];

  useEffect(() => {
    loadChains();
  }, []);

  const loadChains = async () => {
    try {
      if (window.electronAPI?.chain) {
        const chains = await window.electronAPI.chain.getEVMChains(true);
        // chains are loaded, no need to do anything
      }
    } catch (error) {
      console.error('Failed to load chains:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
    }));

    // 实时校验代币合约地址
    if (name === 'tokenAddress') {
      if (value.trim()) {
        // EVM地址：以0x开头，后面40个十六进制字符（总共42字符）
        const isEVMAddress = /^0x[a-fA-F0-9]{40}$/i.test(value);
        // Solana地址：Base58编码，44个字符
        const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{44}$/.test(value);

        console.log('校验:', {
          value: value,
          length: value.length,
          isEVMAddress,
          isSolanaAddress
        });

        if (!isEVMAddress && !isSolanaAddress) {
          let errorMsg = '请输入有效的代币合约地址。';
          if (value.startsWith('0x')) {
            if (value.length !== 42) {
              errorMsg += 'EVM地址应为42字符（以0x开头）';
            } else {
              errorMsg += 'EVM地址包含无效字符';
            }
          } else if (value.length < 43 || value.length > 44) {
            errorMsg += 'Solana地址应为43-44字符';
          } else {
            errorMsg += '当前格式不被支持';
          }
          setTokenAddressError(errorMsg);
        } else {
          setTokenAddressError('');
        }
      } else {
        setTokenAddressError('');
      }
    }
  };

  const handleCSVContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    setCsvContent(content);

    if (content.trim()) {
      try {
        // Parse CSV content (no headers expected)
        const lines = content.trim().split('\n').filter(line => line.trim());

        // Parse data rows (expecting address,amount format)
        const data = [];
        const errors = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(',').map(v => v.trim());

          if (values.length < 2) {
            errors.push(`第 ${i + 1} 行: 格式错误，需要包含地址和金额`);
            continue;
          }

          const address = values[0];
          const amount = values[1];

          // Validate address format (EVM or Solana)
          const isEVMAddress = /^0x[a-fA-F0-9]{40}$/.test(address);
          const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);

          if (!isEVMAddress && !isSolanaAddress) {
            errors.push(`第 ${i + 1} 行: 地址格式无效`);
            continue;
          }

          // Validate amount
          const amountNum = parseFloat(amount);
          if (isNaN(amountNum) || amountNum <= 0) {
            errors.push(`第 ${i + 1} 行: 金额必须是大于0的数字`);
            continue;
          }

          data.push({
            address: address,
            amount: amount
          });
        }

        setCsvData(data);
        const validation = {
          isValid: data.length > 0,
          totalRecords: lines.length,
          validRecords: data.length,
          invalidRecords: lines.length - data.length,
          errors: errors,
          sampleData: data.slice(0, 5)
        };
        setCsvValidation(validation);
      } catch (error) {
        console.error('Failed to parse CSV:', error);
        setCsvValidation({
          isValid: false,
          totalRecords: 0,
          validRecords: 0,
          invalidRecords: 0,
          errors: ['CSV内容解析失败'],
          sampleData: []
        });
      }
    } else {
      setCsvValidation(null);
      setCsvData([]);
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      alert('请输入活动名称');
      return false;
    }
    if (!formData.chain) {
      alert('请选择区块链网络');
      return false;
    }
    if (!formData.tokenAddress.trim()) {
      alert('请输入代币合约地址');
      return false;
    }
    if (tokenAddressError) {
      alert(tokenAddressError);
      return false;
    }
    if (!csvContent.trim()) {
      alert('请输入CSV内容');
      return false;
    }
    if (!csvValidation?.isValid) {
      alert('CSV内容格式不正确');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const campaignData = {
        name: formData.name,
        description: formData.description,
        chain: formData.chain,
        tokenAddress: formData.tokenAddress,
        batchSize: formData.batchSize,
        sendInterval: Number(formData.sendInterval),
        recipients: csvData  // 使用解析后的数据数组
      };

      if (window.electronAPI?.campaign) {
        const newCampaign = await window.electronAPI.campaign.create(campaignData);
        alert('活动创建成功！');
        navigate(`/campaign/${newCampaign.id}`);
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);
      alert(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEstimate = async () => {
    if (!formData.chain || !formData.tokenAddress || !csvValidation?.isValid) {
      alert('请先填写完整的表单信息并确保CSV数据有效');
      return;
    }

    setIsEstimating(true);
    try {
      const estimateRequest = {
        chain: formData.chain,
        tokenAddress: formData.tokenAddress,
        recipientCount: csvValidation.validRecords,
        batchSize: formData.batchSize,
      };

      if (window.electronAPI?.campaign) {
        const result = await window.electronAPI.campaign.estimate(estimateRequest);
        setEstimation(result);
      }
    } catch (error) {
      console.error('Failed to estimate campaign:', error);
      alert(`估算失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsEstimating(false);
    }
  };

  const getChainInfo = (chainId: string) => {
    return availableChains.find(c => c.id === chainId) || { name: 'Unknown', symbol: '' };
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📋</span>
          <h1 className="text-2xl font-bold">创建新活动</h1>
        </div>
        <button
          onClick={() => navigate('/')}
          className="btn btn-ghost btn-sm"
        >
          ← 返回仪表盘
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="collapse collapse-arrow bg-base-100 shadow-sm">
          <input type="checkbox" defaultChecked className="min-w-fit" />
          <div className="collapse-title text-lg font-semibold flex items-center gap-3">
            <span className="text-xl">📋</span>
            基本信息
          </div>
          <div className="collapse-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <div className="mb-2">
                  <span className="text-sm font-medium">活动名称 *</span>
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="例如：2025年营销活动"
                  className="input input-bordered w-full"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  required
                />
              </div>

              <div>
                <div className="mb-2">
                  <span className="text-sm font-medium">区块链网络 *</span>
                </div>
                <select
                  name="chain"
                  value={formData.chain}
                  onChange={handleInputChange}
                  className="select select-bordered w-full"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  required
                >
                  {availableChains.map(chain => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name} ({chain.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <div className="mb-2">
                  <span className="text-sm font-medium">代币合约地址 *</span>
                </div>
                <input
                  type="text"
                  name="tokenAddress"
                  value={formData.tokenAddress}
                  onChange={handleInputChange}
                  placeholder="EVM: 0xA0b86a33E6447b4C4A0b2F9D6d2eEa6d1b7d94a2 或 Solana: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
                  className={`input input-bordered w-full font-mono ${tokenAddressError ? 'input-error' : ''}`}
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  required
                />
                {tokenAddressError && (
                  <div className="mt-1">
                    <span className="text-xs text-error">{tokenAddressError}</span>
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <div className="mb-2">
                  <span className="text-sm font-medium">活动描述</span>
                </div>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="textarea textarea-bordered h-24 w-full"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  placeholder="描述此活动的目的和详情..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Batch Settings */}
        <div className="collapse collapse-arrow bg-base-100 shadow-sm">
          <input type="checkbox" defaultChecked className="min-w-fit" />
          <div className="collapse-title text-lg font-semibold flex items-center gap-3">
            <span className="text-xl">⚙️</span>
            批量设置
          </div>
          <div className="collapse-content">
            <div className="space-y-6 mt-4">
              <div>
                <div className="mb-3">
                  <span className="text-sm font-medium">每批处理地址数量</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[50, 100, 200, 500].map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, batchSize: size }))}
                      className={`btn ${formData.batchSize === size ? 'btn-primary' : 'btn-outline'}`}
                    >
                      {size} {size === 50 && '(推荐)'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3">
                  <span className="text-sm font-medium">批次发送间隔</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: '15000', label: '15秒', recommended: true },
                    { value: '20000', label: '20秒' },
                    { value: '30000', label: '30秒' },
                    { value: '45000', label: '45秒' },
                    { value: '60000', label: '60秒' }
                  ].map(interval => (
                    <button
                      key={interval.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, sendInterval: interval.value }))}
                      className={`btn ${formData.sendInterval === interval.value ? 'btn-primary' : 'btn-outline'}`}
                    >
                      {interval.label} {interval.recommended && '(推荐)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CSV Input */}
        <div className="collapse collapse-arrow bg-base-100 shadow-sm">
          <input type="checkbox" defaultChecked className="min-w-fit" />
          <div className="collapse-title text-lg font-semibold flex items-center gap-3">
            <span className="text-xl">📁</span>
            输入地址列表
          </div>
          <div className="collapse-content">
            <div className="space-y-6">
              <div>
                <div className="mb-2">
                  <span className="text-sm font-medium">CSV 内容 *</span>
                </div>
                <textarea
                  value={csvContent}
                  onChange={handleCSVContentChange}
                  className="textarea textarea-bordered font-mono text-sm h-96 resize-none w-full"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  placeholder="请粘贴CSV内容，格式：地址,金额&#10;&#10;示例（EVM地址）：&#10;0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb,100.5&#10;0xdAC17F958D2ee523a2206206994597C13D831ec7,200&#10;&#10;示例（Solana地址）：&#10;7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU,50.25&#10;DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK,150"
                  required
                />
              </div>

              {csvValidation && (
                <div>
                  <div className="mb-2">
                    <span className="text-sm font-medium">数据预览</span>
                  </div>
                  {csvValidation && csvValidation.isValid ? (
                    <div className="bg-base-200 rounded-lg p-4 h-96 overflow-auto">
                      {/* 错误警告（如果有） */}
                      {csvValidation.errors.length > 0 && (
                        <div className="alert alert-warning mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <div>
                            <div className="font-bold text-sm">{csvValidation.invalidRecords} 行数据有误</div>
                            <div className="text-xs">将只处理 {csvValidation.validRecords} 条有效记录</div>
                          </div>
                        </div>
                      )}

                      {/* 统计信息 */}
                      <div className="stats shadow-sm bg-base-100">
                        <div className="stat">
                          <div className="stat-title text-xs">有效地址数</div>
                          <div className="stat-value text-lg">{csvValidation.validRecords}</div>
                        </div>

                        <div className="stat">
                          <div className="stat-title text-xs">总代币数</div>
                          <div className="stat-value text-lg">
                            {csvData.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                          </div>
                        </div>

                        <div className="stat">
                          <div className="stat-title text-xs">批次数量</div>
                          <div className="stat-value text-lg">
                            {Math.ceil(csvValidation.validRecords / formData.batchSize)}
                          </div>
                        </div>

                        <div className="stat">
                          <div className="stat-title text-xs">预估总时长</div>
                          <div className="stat-value text-lg">
                            {(() => {
                              const batches = Math.ceil(csvValidation.validRecords / formData.batchSize);
                              const totalSeconds = (batches * parseInt(formData.sendInterval)) / 1000;
                              const minutes = Math.floor(totalSeconds / 60);
                              const seconds = Math.floor(totalSeconds % 60);
                              return `${minutes}分${seconds}秒`;
                            })()}
                          </div>
                        </div>

                        <div className="stat">
                          <div className="stat-title text-xs">预估 Gas 费</div>
                          <div className="stat-value text-sm text-warning">计算中...</div>
                        </div>
                      </div>

                      {/* 状态提示 */}
                      <div className="alert alert-success mt-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium">
                          {csvValidation.errors.length === 0 ? '数据验证通过' : '部分数据有效'}
                        </span>
                      </div>

                      {/* 错误详情（如果有） */}
                      {csvValidation.errors.length > 0 && (
                        <div className="mt-4">
                          <div className="text-xs font-bold mb-2">错误详情：</div>
                          <div className="space-y-1 max-h-32 overflow-auto">
                            {csvValidation.errors.slice(0, 10).map((error, index) => (
                              <div key={index} className="text-xs bg-error/10 text-error p-2 rounded">
                                {error}
                              </div>
                            ))}
                            {csvValidation.errors.length > 10 && (
                              <div className="text-xs opacity-70 mt-1">
                                ... 还有 {csvValidation.errors.length - 10} 个错误
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-error/5 border border-error/20 rounded-lg p-4 h-96">
                      <div className="alert alert-error">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <div className="font-bold text-sm">没有有效数据</div>
                          <div className="text-xs">请检查CSV格式是否正确</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Campaign Estimation */}
        {csvValidation?.isValid && (
          <div className="bg-base-100 shadow-sm rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">💰</span>
                <h2 className="text-lg font-semibold">活动成本估算</h2>
              </div>
              <button
                type="button"
                onClick={handleEstimate}
                disabled={isEstimating || !formData.chain || !formData.tokenAddress}
                className="btn btn-sm btn-primary"
              >
                {isEstimating ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    估算中...
                  </>
                ) : (
                  '开始估算'
                )}
              </button>
            </div>

            {estimation ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="stat bg-base-200 rounded-lg p-4">
                    <div className="stat-title text-xs">总接收者</div>
                    <div className="stat-value text-2xl">{estimation.totalRecipients}</div>
                    <div className="stat-desc">{estimation.estimatedBatches} 批次</div>
                  </div>

                  <div className="stat bg-base-200 rounded-lg p-4">
                    <div className="stat-title text-xs">Gas 成本 (ETH)</div>
                    <div className="stat-value text-2xl">{estimation.estimatedGasCostETH}</div>
                    <div className="stat-desc">约 ${estimation.estimatedGasCostUSD}</div>
                  </div>

                  <div className="stat bg-base-200 rounded-lg p-4">
                    <div className="stat-title text-xs">Gas 价格</div>
                    <div className="stat-value text-2xl">{estimation.gasPrice}</div>
                    <div className="stat-desc">Gwei</div>
                  </div>

                  <div className="stat bg-base-200 rounded-lg p-4">
                    <div className="stat-title text-xs">预计耗时</div>
                    <div className="stat-value text-2xl">{estimation.estimatedDuration}</div>
                    <div className="stat-desc">分钟</div>
                  </div>
                </div>

                <div className="alert alert-info">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div className="text-sm">
                    <div className="font-bold">建议</div>
                    <div>最优批次大小: {estimation.recommendations.optimalBatchSize} 地址/批次</div>
                    <div>每批耗时: {estimation.recommendations.estimatedTimePerBatch} 秒</div>
                    <div>总预计时间: {estimation.recommendations.totalEstimatedTime} 分钟</div>
                  </div>
                </div>

                <div className="alert alert-warning">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="text-sm">
                    <div className="font-bold">重要提醒</div>
                    <div>以上估算仅供参考，实际Gas费用可能因网络状况而有所不同</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-base-content/60">
                <p>点击"开始估算"按钮获取活动成本预估</p>
              </div>
            )}
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn btn-ghost"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                创建中...
              </>
            ) : (
              '创建活动'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}