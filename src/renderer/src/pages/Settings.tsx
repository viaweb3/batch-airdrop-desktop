import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  AppSettings,
  EVMChain,
  ChainConfigurationForm,
  NetworkTestResult
} from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chain: EVMChain | null;
  onSave: (chainData: ChainConfigurationForm) => void;
  onTest: (chainId: number) => void;
  testResults: Record<number, NetworkTestResult>;
}

function ChainEditModal({ isOpen, onClose, chain, onSave, onTest, testResults }: SettingsModalProps) {
  const [formData, setFormData] = useState<ChainConfigurationForm>({
    name: '',
    chainId: 1,
    rpcUrl: '',
    rpcBackup: '',
    explorerUrl: '',
    symbol: '',
    decimals: 18,
    gasPrice: 30,
    gasLimit: 210000,
    batchSize: 100,
    sendInterval: 2000,
    enabled: true,
    isCustom: false,
  });

  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (chain) {
      setFormData({
        id: chain.id,
        name: chain.name,
        chainId: chain.chainId,
        rpcUrl: chain.rpcUrl,
        rpcBackup: chain.rpcBackup || '',
        explorerUrl: chain.explorerUrl,
        symbol: chain.symbol,
        decimals: chain.decimals,
        gasPrice: 30,
        gasLimit: 210000,
        batchSize: 100,
        sendInterval: 2000,
        enabled: chain.enabled,
        isCustom: chain.isCustom,
      });
    }
  }, [chain]);

  if (!isOpen) {
    return null;
  }
  if (!chain) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleTest = async () => {
    if (isTesting) {
      return;
    }

    setIsTesting(true);
    try {
      await onTest(chain.chainId);
    } catch (error) {
      console.error('测试失败:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const testResult = testResults[chain.chainId];

  const isNewChain = !chain.id || chain.id === 0;

  const modalContent = (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {isNewChain ? '➕ 添加自定义网络' : `⚙️ 编辑 ${chain.name} 配置`}
          </h2>
          <button
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic Chain Information */}
          <div className="collapse collapse-arrow bg-base-200 mb-4">
            <input type="checkbox" defaultChecked className="min-w-fit" />
            <div className="collapse-title text-lg font-semibold">
              🔗 基础信息
            </div>
            <div className="collapse-content">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">链名称</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input input-bordered"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Chain ID</span>
                  </label>
                  <input
                    type="number"
                    value={formData.chainId}
                    onChange={(e) => setFormData({ ...formData, chainId: parseInt(e.target.value) })}
                    className="input input-bordered"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    required
                  />
                </div>
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text font-medium">RPC 节点 URL</span>
                </label>
                <input
                  type="url"
                  value={formData.rpcUrl}
                  onChange={(e) => setFormData({ ...formData, rpcUrl: e.target.value })}
                  className="input input-bordered"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  placeholder="https://polygon.llamarpc.com"
                  required
                />
                <label className="label">
                  <span className="label-text-alt">建议配置多个 URL 以实现冗余备份</span>
                </label>
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text font-medium">备用 RPC URL</span>
                </label>
                <input
                  type="url"
                  value={formData.rpcBackup}
                  onChange={(e) => setFormData({ ...formData, rpcBackup: e.target.value })}
                  className="input input-bordered"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  placeholder="https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID"
                />
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text font-medium">区块链浏览器 URL</span>
                </label>
                <input
                  type="url"
                  value={formData.explorerUrl}
                  onChange={(e) => setFormData({ ...formData, explorerUrl: e.target.value })}
                  className="input input-bordered"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  placeholder="https://polygonscan.com"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">代币符号</span>
                  </label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    className="input input-bordered"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    placeholder="MATIC"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">代币精度</span>
                  </label>
                  <input
                    type="number"
                    value={formData.decimals}
                    onChange={(e) => setFormData({ ...formData, decimals: parseInt(e.target.value) })}
                    className="input input-bordered"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    min="0"
                    max="18"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Test Connection */}
          <div className="card bg-base-100 shadow-sm mb-6">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <span>🔗</span>
                  连接测试
                </h3>
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting}
                  className={`btn ${isTesting ? 'btn-disabled' : 'btn-outline'}`}
                >
                  {isTesting ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      测试中...
                    </>
                  ) : (
                    '🧪 测试连接'
                  )}
                </button>
              </div>

              {testResult && (
                <div className={`alert mt-4 ${
                  testResult.status === 'success' ? 'alert-success' : 'alert-error'
                }`}>
                  <div>
                    <div className="font-bold">
                      {testResult.status === 'success' ? '✅ 连接成功' : '❌ 连接失败'}
                    </div>
                    <div className="text-sm">
                      延迟: {testResult.latency}ms | 区块: {testResult.blockNumber} | Gas: {testResult.gasPrice} Gwei
                    </div>
                    {testResult.error && (
                      <div className="text-xs mt-2">错误详情: {testResult.error}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="modal-action">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              💾 保存设置
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings>({
    chains: [],
    gasSettings: {
      defaultGasPrice: 30,
      defaultGasLimit: 210000,
      autoAdjustGas: true,
      maxGasPrice: 100,
      priorityFee: 2,
    },
    batchSettings: {
      batchSize: 100,
      sendInterval: 2000,
      maxConcurrency: 5,
      retryAttempts: 3,
      retryDelay: 1000,
    },
    securitySettings: {
      autoBackup: true,
      backupInterval: 24,
      encryptPrivateKeys: true,
      sessionTimeout: 30,
      requirePassword: false,
    },
    notificationSettings: {
      emailNotifications: false,
      browserNotifications: true,
      campaignComplete: true,
      campaignFailed: true,
      lowBalance: true,
      securityAlerts: true,
    },
  });

  const [activeTab] = useState<'chains'>('chains');
  const [editingChain, setEditingChain] = useState<EVMChain | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testResults, setTestResults] = useState<Record<number, NetworkTestResult>>({});

  useEffect(() => {
    loadSettings();
    loadChains();
  }, []);

  const loadSettings = async () => {
    try {
      // Settings service removed, using default state
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadChains = async () => {
    try {
      if (window.electronAPI?.chain) {
        const chains = await window.electronAPI.chain.getEVMChains();
        setSettings(prev => ({ ...prev, chains }));
      }
    } catch (error) {
      console.error('Failed to load chains:', error);
      // Mock data for demonstration
      const mockChains: EVMChain[] = [
        {
          id: 1,
          type: 'evm',
          chainId: 1,
          name: 'Ethereum',
          rpcUrl: 'https://eth.llamarpc.com',
          explorerUrl: 'https://etherscan.io',
          symbol: 'ETH',
          decimals: 18,
          enabled: true,
          isCustom: false,
        },
        {
          id: 2,
          type: 'evm',
          chainId: 137,
          name: 'Polygon',
          rpcUrl: 'https://polygon.llamarpc.com',
          explorerUrl: 'https://polygonscan.com',
          symbol: 'MATIC',
          decimals: 18,
          enabled: true,
          isCustom: false,
        },
        {
          id: 3,
          type: 'evm',
          chainId: 8453,
          name: 'Base',
          rpcUrl: 'https://mainnet.base.org',
          explorerUrl: 'https://basescan.org',
          symbol: 'ETH',
          decimals: 18,
          enabled: true,
          isCustom: false,
        },
        {
          id: 4,
          type: 'evm',
          chainId: 42161,
          name: 'Arbitrum',
          rpcUrl: 'https://arb1.arbitrum.io/rpc',
          explorerUrl: 'https://arbiscan.io',
          symbol: 'ETH',
          decimals: 18,
          enabled: false,
          isCustom: false,
        },
        {
          id: 5,
          type: 'evm',
          chainId: 10,
          name: 'Optimism',
          rpcUrl: 'https://mainnet.optimism.io',
          explorerUrl: 'https://optimistic.etherscan.io',
          symbol: 'ETH',
          decimals: 18,
          enabled: false,
          isCustom: false,
        },
      ];
      setSettings(prev => ({ ...prev, chains: mockChains }));
    }
  };

  const handleEditChain = (chain: EVMChain) => {
    setEditingChain(chain);
    setIsModalOpen(true);
  };

  const handleAddChain = () => {
    const newChain = {
      id: 0,
      type: 'evm' as const,
      chainId: 0,
      name: '',
      rpcUrl: '',
      explorerUrl: '',
      symbol: '',
      decimals: 18,
      enabled: true,
      isCustom: true,
    };
    setEditingChain(newChain);
    setIsModalOpen(true);
  };

  const handleSaveChain = async (chainData: ChainConfigurationForm) => {
    try {
      if (window.electronAPI?.chain) {
        if (chainData.id && chainData.id > 0) {
          // 更新现有链
          await window.electronAPI.chain.updateEVMChain(chainData.id, chainData);
        } else {
          // 添加新链
          const newId = await window.electronAPI.chain.addEVMChain(chainData);
          chainData.id = newId;
        }
      }

      setSettings(prev => {
        const chains = prev.chains || [];
        if (chainData.id && chainData.id > 0 && chains.some(c => c.id === chainData.id)) {
          // 更新现有链
          return {
            ...prev,
            chains: chains.map(chain =>
              chain.id === chainData.id ? { ...chain, ...chainData } : chain
            )
          };
        } else {
          // 添加新链
          const newChain: EVMChain = {
            id: chainData.id || Date.now(),
            type: 'evm',
            chainId: chainData.chainId,
            name: chainData.name,
            rpcUrl: chainData.rpcUrl,
            rpcBackup: chainData.rpcBackup,
            explorerUrl: chainData.explorerUrl,
            symbol: chainData.symbol,
            decimals: chainData.decimals,
            enabled: chainData.enabled,
            isCustom: true,
          };
          return {
            ...prev,
            chains: [...chains, newChain]
          };
        }
      });

      setIsModalOpen(false);
      setEditingChain(null);
    } catch (error) {
      console.error('Failed to save chain:', error);
      alert('保存链配置失败，请重试');
    }
  };

  const handleTestChain = async (chainId: number) => {
    try {
      if (window.electronAPI?.chain) {
        const result = await window.electronAPI.chain.testEVMLatency(chainId);
        setTestResults(prev => ({
          ...prev,
          [chainId]: {
            chainId,
            latency: result.latency,
            blockNumber: result.blockNumber,
            gasPrice: 30,
            status: 'success',
            timestamp: new Date().toISOString(),
          }
        }));
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [chainId]: {
          chainId,
          latency: 0,
          blockNumber: 0,
          gasPrice: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : '连接失败',
          timestamp: new Date().toISOString(),
        }
      }));
    }
  };

  
  return (
    <>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚙️</span>
            <h1 className="text-2xl font-bold">区块链网络设置</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddChain}
              className="btn btn-primary"
            >
              ➕ 添加自定义网络
            </button>
            <button
              onClick={() => navigate('/')}
              className="btn btn-ghost"
            >
              ← 返回仪表盘
            </button>
          </div>
        </div>

        {/* Chain List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(settings.chains || []).map((chain) => (
            <div
              key={chain.id}
              className="card bg-base-100 shadow-sm hover:shadow-md transition-all border-2 border-transparent hover:border-primary/20"
            >
              {/* Chain Icon & Info */}
              <div className="card-body">
                <div className="flex items-center gap-3 mb-4">
                  <div className="avatar placeholder">
                    <div className="bg-neutral text-neutral-content rounded-full w-12 h-12">
                      <span className="text-lg">
                        {chain.symbol === 'ETH' && '🔷'}
                        {chain.symbol === 'MATIC' && '🟣'}
                        {chain.symbol === 'BNB' && '🟡'}
                        {!['ETH', 'MATIC', 'BNB'].includes(chain.symbol) && '⚡'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="card-title text-lg">{chain.name}</h2>
                    <div className="flex items-center gap-2">
                      <div className="badge badge-outline badge-sm">{chain.symbol}</div>
                    </div>
                  </div>
                </div>

                {/* Chain Details */}
                <div className="divider my-2"></div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-content/60">Chain ID</span>
                    <div className="font-mono text-sm bg-base-200 px-2 py-1 rounded">{chain.chainId}</div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-content/60">精度</span>
                    <span className="text-sm font-medium">{chain.decimals}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="card-actions justify-end">
                  <button
                    onClick={() => handleEditChain(chain)}
                    className="btn btn-sm btn-outline"
                  >
                    ⚙️ 编辑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {(!settings.chains || settings.chains.length === 0) && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🌐</div>
            <div className="text-lg font-medium mb-2">暂无区块链网络</div>
            <div className="text-sm text-base-content/60 mb-6">
              点击上方"添加自定义网络"开始配置
            </div>
            <button
              onClick={handleAddChain}
              className="btn btn-primary"
            >
              ➕ 添加第一个网络
            </button>
          </div>
        )}

        {/* Quick Tips */}
        <div className="alert alert-info mt-8">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 className="font-bold">快速提示</h3>
            <div className="text-sm">
              • 建议为每个网络配置多个 RPC URL 以提高连接稳定性<br/>
              • 自定义网络支持测试网和主网配置<br/>
              • 编辑网络前建议先测试连接以确保配置正确
            </div>
          </div>
        </div>
      </div>

      {/* Chain Edit Modal */}
      <ChainEditModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingChain(null);
        }}
        chain={editingChain}
        onSave={handleSaveChain}
        onTest={handleTestChain}
        testResults={testResults}
      />
    </>
  );
}
