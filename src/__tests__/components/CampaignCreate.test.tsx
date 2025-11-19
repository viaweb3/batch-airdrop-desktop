import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { jest } from '@jest/globals';
import CampaignCreate from '../../renderer/src/pages/CampaignCreate';

// Mock Electron API
const mockElectronAPI = {
  wallet: {
    generateWallet: jest.fn(),
    validatePrivateKey: jest.fn(),
  },
  contract: {
    deploy: jest.fn(),
  },
  campaign: {
    create: jest.fn(),
  },
  gas: {
    getGasInfo: jest.fn(),
  }
};

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
});

// Mock React Router
const MockRouter = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

// Mock responses
const mockWallet = {
  address: '0x1234567890123456789012345678901234567890',
  privateKey: '0x' + '1'.repeat(64),
  publicKey: '0x' + '2'.repeat(128)
};

const mockContractDeployment = {
  contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  blockNumber: 12345,
  gasUsed: '150000'
};

const mockGasInfo = {
  gasPrice: '20',
  network: 'ethereum',
  gasLimit: '1000000',
  estimatedCost: '0.02'
};

describe('CampaignCreate Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.wallet.generateWallet.mockResolvedValue(mockWallet);
    mockElectronAPI.contract.deploy.mockResolvedValue(mockContractDeployment);
    mockElectronAPI.campaign.create.mockResolvedValue({ id: '1', success: true });
    mockElectronAPI.gas.getGasInfo.mockResolvedValue(mockGasInfo);
  });

  const renderCampaignCreate = () => {
    return render(
      <MockRouter>
        <CampaignCreate />
      </MockRouter>
    );
  };

  test('renders campaign creation form', async () => {
    renderCampaignCreate();

    await waitFor(() => {
      expect(screen.getByText('创建新活动')).toBeInTheDocument();
    });

    // Check form fields
    expect(screen.getByLabelText(/活动名称/)).toBeInTheDocument();
    expect(screen.getByLabelText(/代币合约地址/)).toBeInTheDocument();
    expect(screen.getByLabelText(/选择区块链网络/)).toBeInTheDocument();
    expect(screen.getByLabelText(/RPC URL/)).toBeInTheDocument();
    expect(screen.getByLabelText(/发奖人私钥/)).toBeInTheDocument();
  });

  test('shows initial form step', async () => {
    renderCampaignCreate();

    await waitFor(() => {
      expect(screen.getByText('基本信息')).toBeInTheDocument();
      expect(screen.getByText('下一步')).toBeInTheDocument();
      expect(screen.queryByText('上一步')).not.toBeInTheDocument();
    });
  });

  test('validates required fields', async () => {
    renderCampaignCreate();

    await waitFor(() => {
      expect(screen.getByText('下一步')).toBeInTheDocument();
    });

    // Try to proceed without filling required fields
    const nextButton = screen.getByText('下一步');
    await user.click(nextButton);

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/活动名称是必填项/)).toBeInTheDocument();
    });
  });

  test('fills form and proceeds through steps', async () => {
    renderCampaignCreate();

    await waitFor(() => {
      expect(screen.getByLabelText(/活动名称/)).toBeInTheDocument();
    });

    // Fill basic information
    await user.type(screen.getByLabelText(/活动名称/), 'Test Campaign');
    await user.type(screen.getByLabelText(/代币合约地址/), '0x1234567890123456789012345678901234567890');

    // Select network
    const networkSelect = screen.getByLabelText(/选择区块链网络/);
    await user.selectOptions(networkSelect, 'ethereum');

    // Click next to go to wallet step
    await user.click(screen.getByText('下一步'));

    await waitFor(() => {
      expect(screen.getByText('部署智能合约')).toBeInTheDocument();
    });
  });

  test('generates new wallet', async () => {
    renderCampaignCreate();

    await waitFor(() => {
      expect(screen.getByLabelText(/活动名称/)).toBeInTheDocument();
    });

    // Fill basic information first
    await user.type(screen.getByLabelText(/活动名称/), 'Test Campaign');
    await user.type(screen.getByLabelText(/代币合约地址/), '0x1234567890123456789012345678901234567890');
    await user.selectOptions(screen.getByLabelText(/选择区块链网络/), 'ethereum');
    await user.click(screen.getByText('下一步'));

    await waitFor(() => {
      expect(screen.getByText('生成新钱包')).toBeInTheDocument();
    });

    await user.click(screen.getByText('生成新钱包'));

    await waitFor(() => {
      expect(mockElectronAPI.wallet.generateWallet).toHaveBeenCalled();
      expect(screen.getByText(/0x1234567890123456789012345678901234567890/)).toBeInTheDocument();
    });
  });

  test('deploys contract and creates campaign', async () => {
    renderCampaignCreate();

    await waitFor(() => {
      expect(screen.getByLabelText(/活动名称/)).toBeInTheDocument();
    });

    // Fill all steps
    await user.type(screen.getByLabelText(/活动名称/), 'Test Campaign');
    await user.type(screen.getByLabelText(/代币合约地址/), '0x1234567890123456789012345678901234567890');
    await user.selectOptions(screen.getByLabelText(/选择区块链网络/), 'ethereum');

    await user.click(screen.getByText('下一步')); // Go to wallet step

    await waitFor(() => {
      expect(screen.getByText('生成新钱包')).toBeInTheDocument();
    });

    await user.click(screen.getByText('生成新钱包'));

    await waitFor(() => {
      expect(screen.getByText('下一步')).toBeInTheDocument();
    });

    await user.click(screen.getByText('下一步')); // Go to deploy step

    await waitFor(() => {
      expect(screen.getByText('部署智能合约')).toBeInTheDocument();
    });

    await user.click(screen.getByText('部署合约并创建活动'));

    await waitFor(() => {
      expect(mockElectronAPI.contract.deploy).toHaveBeenCalled();
      expect(mockElectronAPI.campaign.create).toHaveBeenCalled();
    });
  });

  test('shows gas estimation information', async () => {
    renderCampaignCreate();

    await waitFor(() => {
      expect(screen.getByLabelText(/活动名称/)).toBeInTheDocument();
    });

    // Navigate to deploy step
    await user.type(screen.getByLabelText(/活动名称/), 'Test Campaign');
    await user.type(screen.getByLabelText(/代币合约地址/), '0x1234567890123456789012345678901234567890');
    await user.selectOptions(screen.getByLabelText(/选择区块链网络/), 'ethereum');
    await user.click(screen.getByText('下一步'));

    await waitFor(() => {
      expect(screen.getByText('生成新钱包')).toBeInTheDocument();
    });

    await user.click(screen.getByText('生成新钱包'));
    await user.click(screen.getByText('下一步'));

    await waitFor(() => {
      expect(mockElectronAPI.gas.getGasInfo).toHaveBeenCalled();
    });
  });

  test('validates wallet private key', async () => {
    renderCampaignCreate();

    // Fill basic info first
    await waitFor(() => {
      expect(screen.getByLabelText(/活动名称/)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/活动名称/), 'Test Campaign');
    await user.type(screen.getByLabelText(/代币合约地址/), '0x1234567890123456789012345678901234567890');
    await user.selectOptions(screen.getByLabelText(/选择区块链网络/), 'ethereum');
    await user.click(screen.getByText('下一步'));

    await waitFor(() => {
      expect(screen.getByText('下一步')).toBeInTheDocument();
    });

    // Try to proceed without wallet
    await user.click(screen.getByText('下一步'));

    await waitFor(() => {
      expect(screen.getByText(/请生成或导入钱包/)).toBeInTheDocument();
    });
  });

  test('handles deployment errors', async () => {
    mockElectronAPI.contract.deploy.mockRejectedValue(new Error('Deployment failed'));

    renderCampaignCreate();

    // Navigate through all steps
    await waitFor(() => {
      expect(screen.getByLabelText(/活动名称/)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/活动名称/), 'Test Campaign');
    await user.type(screen.getByLabelText(/代币合约地址/), '0x1234567890123456789012345678901234567890');
    await user.selectOptions(screen.getByLabelText(/选择区块链网络/), 'ethereum');
    await user.click(screen.getByText('下一步'));

    await waitFor(() => {
      expect(screen.getByText('生成新钱包')).toBeInTheDocument();
    });

    await user.click(screen.getByText('生成新钱包'));
    await user.click(screen.getByText('下一步'));

    await waitFor(() => {
      expect(screen.getByText('部署合约并创建活动')).toBeInTheDocument();
    });

    await user.click(screen.getByText('部署合约并创建活动'));

    await waitFor(() => {
      expect(screen.getByText(/部署失败/)).toBeInTheDocument();
    });
  });

  test('allows navigation between steps', async () => {
    renderCampaignCreate();

    await waitFor(() => {
      expect(screen.getByLabelText(/活动名称/)).toBeInTheDocument();
    });

    // Fill first step
    await user.type(screen.getByLabelText(/活动名称/), 'Test Campaign');
    await user.type(screen.getByLabelText(/代币合约地址/), '0x1234567890123456789012345678901234567890');
    await user.selectOptions(screen.getByLabelText(/选择区块链网络/), 'ethereum');
    await user.click(screen.getByText('下一步'));

    await waitFor(() => {
      expect(screen.getByText('下一步')).toBeInTheDocument();
    });

    // Should see back button now
    expect(screen.getByText('上一步')).toBeInTheDocument();

    // Go back
    await user.click(screen.getByText('上一步'));

    await waitFor(() => {
      expect(screen.getByText('基本信息')).toBeInTheDocument();
      expect(screen.queryByText('上一步')).not.toBeInTheDocument();
    });
  });

  test('changes network presets correctly', async () => {
    renderCampaignCreate();

    await waitFor(() => {
      expect(screen.getByLabelText(/选择区块链网络/)).toBeInTheDocument();
    });

    const networkSelect = screen.getByLabelText(/选择区块链网络/);

    // Select different networks and check RPC URL changes
    await user.selectOptions(networkSelect, 'polygon');
    await waitFor(() => {
      expect(screen.getByDisplayValue(/polygon/)).toBeInTheDocument();
    });

    await user.selectOptions(networkSelect, 'bsc');
    await waitFor(() => {
      expect(screen.getByDisplayValue(/bsc/)).toBeInTheDocument();
    });
  });

  test('shows loading states during operations', async () => {
    // Make wallet generation take time
    mockElectronAPI.wallet.generateWallet.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockWallet), 100))
    );

    renderCampaignCreate();

    // Navigate to wallet step
    await waitFor(() => {
      expect(screen.getByLabelText(/活动名称/)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/活动名称/), 'Test Campaign');
    await user.type(screen.getByLabelText(/代币合约地址/), '0x1234567890123456789012345678901234567890');
    await user.selectOptions(screen.getByLabelText(/选择区块链网络/), 'ethereum');
    await user.click(screen.getByText('下一步'));

    await waitFor(() => {
      expect(screen.getByText('生成新钱包')).toBeInTheDocument();
    });

    await user.click(screen.getByText('生成新钱包'));

    // Should show loading state
    expect(screen.getByText('生成中...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('0x1234567890123456789012345678901234567890')).toBeInTheDocument();
    });
  });
});