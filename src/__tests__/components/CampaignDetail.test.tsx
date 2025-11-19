import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { jest } from '@jest/globals';
import CampaignDetail from '../../renderer/src/pages/CampaignDetail';

// Mock React Router's useParams
const mockParams = { id: '1' };
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => mockParams,
  useNavigate: () => jest.fn()
}));

// Mock Electron API
const mockElectronAPI = {
  campaign: {
    getById: jest.fn(),
    update: jest.fn(),
  },
  wallet: {
    unlock: jest.fn(),
    lock: jest.fn(),
  },
  contract: {
    approveTokens: jest.fn(),
    batchTransfer: jest.fn(),
  },
  file: {
    importCSV: jest.fn(),
  },
  gas: {
    getGasInfo: jest.fn(),
    getBatchGasEstimate: jest.fn(),
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

// Mock campaign data
const mockCampaign = {
  id: '1',
  name: 'Test Campaign',
  chain: '1',
  tokenAddress: '0x1234567890123456789012345678901234567890',
  status: 'READY' as const,
  totalRecipients: 0,
  completedRecipients: 0,
  walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  contractAddress: '0x1234567890123456789012345678901234567890',
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-01-15T11:45:00Z'
};

// Mock CSV data
const mockCSVData = [
  { address: '0x1234567890123456789012345678901234567890', amount: '100' },
  { address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', amount: '200' },
  { address: '0x9876543210987654321098765432109876543210', amount: '300' }
];

const mockGasInfo = {
  gasPrice: '20',
  network: 'ethereum',
  gasLimit: '1000000',
  estimatedCost: '0.02'
};

const mockBatchGasEstimate = {
  baseGas: '50000',
  gasPerRecipient: '20000',
  totalGas: '170000',
  estimatedCost: '0.0034',
  recipientCount: 3
};

describe('CampaignDetail Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.campaign.getById.mockResolvedValue(mockCampaign);
    mockElectronAPI.file.importCSV.mockResolvedValue(mockCSVData);
    mockElectronAPI.gas.getGasInfo.mockResolvedValue(mockGasInfo);
    mockElectronAPI.gas.getBatchGasEstimate.mockResolvedValue(mockBatchGasEstimate);
    mockElectronAPI.wallet.unlock.mockResolvedValue({ success: true });
    mockElectronAPI.contract.approveTokens.mockResolvedValue('0xapprovetxhash');
    mockElectronAPI.contract.batchTransfer.mockResolvedValue({
      transactionHash: '0xbatchtxhash',
      totalAmount: '600',
      recipientCount: 3,
      gasUsed: '170000'
    });
  });

  const renderCampaignDetail = () => {
    return render(
      <MockRouter>
        <CampaignDetail />
      </MockRouter>
    );
  };

  test('renders campaign detail with loading state', async () => {
    mockElectronAPI.campaign.getById.mockImplementation(() => new Promise(() => {}));

    renderCampaignDetail();

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  test('renders campaign detail with data', async () => {
    renderCampaignDetail();

    await waitFor(() => {
      expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    });

    expect(screen.getByText('Ethereum')).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });

  test('shows wallet unlock step initially', async () => {
    renderCampaignDetail();

    await waitFor(() => {
      expect(screen.getByText('解锁钱包')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/输入密码/)).toBeInTheDocument();
    });
  });

  test('unlocks wallet successfully', async () => {
    renderCampaignDetail();

    await waitFor(() => {
      expect(screen.getByText('解锁钱包')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/输入密码/), 'password123');
    await user.click(screen.getByText('解锁'));

    await waitFor(() => {
      expect(mockElectronAPI.wallet.unlock).toHaveBeenCalledWith(
        mockCampaign.walletAddress,
        'password123'
      );
    });

    await waitFor(() => {
      expect(screen.getByText('收币地址列表')).toBeInTheDocument();
    });
  });

  test('handles wallet unlock failure', async () => {
    mockElectronAPI.wallet.unlock.mockResolvedValue({ success: false, error: 'Invalid password' });

    renderCampaignDetail();

    await waitFor(() => {
      expect(screen.getByText('解锁钱包')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/输入密码/), 'wrongpassword');
    await user.click(screen.getByText('解锁'));

    await waitFor(() => {
      expect(screen.getByText(/解锁失败/)).toBeInTheDocument();
    });
  });

  test('shows CSV import functionality', async () => {
    renderCampaignDetail();

    await waitFor(() => {
      expect(screen.getByText('解锁钱包')).toBeInTheDocument();
    });

    // First unlock wallet
    await user.type(screen.getByPlaceholderText(/输入密码/), 'password123');
    await user.click(screen.getByText('解锁'));

    await waitFor(() => {
      expect(screen.getByText('导入CSV')).toBeInTheDocument();
    });
  });

  test('imports CSV file', async () => {
    // Mock file input
    const file = new File(['test csv content'], 'test.csv', { type: 'text/csv' });

    renderCampaignDetail();

    await waitFor(() => {
      expect(screen.getByText('解锁钱包')).toBeInTheDocument();
    });

    // Unlock wallet first
    await user.type(screen.getByPlaceholderText(/输入密码/), 'password123');
    await user.click(screen.getByText('解锁'));

    await waitFor(() => {
      expect(screen.getByText('导入CSV')).toBeInTheDocument();
    });

    // Create a mock file input event
    const csvInput = screen.getByRole('button', { name: /导入CSV/ }).closest('div');
    const fileInput = csvInput?.querySelector('input[type="file"]');

    if (fileInput) {
      await user.upload(fileInput, file);
    }

    await waitFor(() => {
      expect(screen.getByText('0x1234567890123456789012345678901234567890')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
    });
  });

  test('shows gas estimation after CSV import', async () => {
    renderCampaignDetail();

    // Unlock wallet
    await waitFor(() => {
      expect(screen.getByText('解锁钱包')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/输入密码/), 'password123');
    await user.click(screen.getByText('解锁'));

    // Import CSV (simulate)
    await waitFor(() => {
      expect(screen.getByText('导入CSV')).toBeInTheDocument();
    });

    // Manually trigger gas estimation
    fireEvent.click(screen.getByText('导入CSV'));

    await waitFor(() => {
      expect(mockElectronAPI.gas.getBatchGasEstimate).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        3
      );
    });
  });

  test('shows approve tokens step', async () => {
    renderCampaignDetail();

    // Unlock wallet first
    await waitFor(() => {
      expect(screen.getByText('解锁钱包')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/输入密码/), 'password123');
    await user.click(screen.getByText('解锁'));

    await waitFor(() => {
      expect(screen.getByText('导入CSV')).toBeInTheDocument();
    });

    // After CSV import, should show approve step
    await waitFor(() => {
      expect(screen.getByText('代币授权')).toBeInTheDocument();
    });
  });

  test('approves tokens successfully', async () => {
    renderCampaignDetail();

    // Unlock wallet
    await waitFor(() => {
      expect(screen.getByText('解锁钱包')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/输入密码/), 'password123');
    await user.click(screen.getByText('解锁'));

    await waitFor(() => {
      expect(screen.getByText('导入CSV')).toBeInTheDocument();
    });

    // Navigate to approve step
    await waitFor(() => {
      expect(screen.getByText('代币授权')).toBeInTheDocument();
    });

    await user.click(screen.getByText('授权'));

    await waitFor(() => {
      expect(mockElectronAPI.contract.approveTokens).toHaveBeenCalled();
    });
  });

  test('executes batch transfer', async () => {
    renderCampaignDetail();

    // Complete all steps
    await waitFor(() => {
      expect(screen.getByText('解锁钱包')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/输入密码/), 'password123');
    await user.click(screen.getByText('解锁'));

    await waitFor(() => {
      expect(screen.getByText('导入CSV')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('代币授权')).toBeInTheDocument();
    });

    await user.click(screen.getByText('授权'));

    await waitFor(() => {
      expect(screen.getByText('执行批量转账')).toBeInTheDocument();
    });

    await user.click(screen.getByText('开始执行'));

    await waitFor(() => {
      expect(mockElectronAPI.contract.batchTransfer).toHaveBeenCalled();
    });
  });

  test('shows progress during batch transfer', async () => {
    // Mock batch transfer to take time and return progress
    mockElectronAPI.contract.batchTransfer.mockImplementation(
      () => new Promise(resolve => {
        setTimeout(() => resolve({
          transactionHash: '0xbatchtxhash',
          totalAmount: '600',
          recipientCount: 3,
          gasUsed: '170000'
        }), 100);
      })
    );

    renderCampaignDetail();

    // Navigate to batch transfer step
    await waitFor(() => {
      expect(screen.getByText('解锁钱包')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/输入密码/), 'password123');
    await user.click(screen.getByText('解锁'));

    // Simulate completion of previous steps
    await waitFor(() => {
      expect(screen.getByText('执行批量转账')).toBeInTheDocument();
    });

    await user.click(screen.getByText('开始执行'));

    // Should show loading/progress state
    expect(screen.getByText(/执行中/)).toBeInTheDocument();
  });

  test('shows completion summary', async () => {
    renderCampaignDetail();

    // Navigate through all steps to completion
    await waitFor(() => {
      expect(screen.getByText('解锁钱包')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/输入密码/), 'password123');
    await user.click(screen.getByText('解锁'));

    await waitFor(() => {
      expect(screen.getByText('执行批量转账')).toBeInTheDocument();
    });

    await user.click(screen.getByText('开始执行'));

    await waitFor(() => {
      expect(screen.getByText('执行完成')).toBeInTheDocument();
      expect(screen.getByText('0xbatchtxhash')).toBeInTheDocument();
      expect(screen.getByText('600')).toBeInTheDocument();
    });
  });

  test('handles campaign not found', async () => {
    mockElectronAPI.campaign.getById.mockResolvedValue(null);

    renderCampaignDetail();

    await waitFor(() => {
      expect(screen.getByText('活动不存在')).toBeInTheDocument();
    });
  });

  test('shows correct status for different campaign states', async () => {
    const sendingCampaign = { ...mockCampaign, status: 'SENDING' as const };
    mockElectronAPI.campaign.getById.mockResolvedValue(sendingCampaign);

    renderCampaignDetail();

    await waitFor(() => {
      expect(screen.getByText('SENDING')).toBeInTheDocument();
    });
  });

  test('displays transaction history', async () => {
    const completedCampaign = {
      ...mockCampaign,
      status: 'COMPLETED' as const,
      totalRecipients: 100,
      completedRecipients: 100
    };
    mockElectronAPI.campaign.getById.mockResolvedValue(completedCampaign);

    renderCampaignDetail();

    await waitFor(() => {
      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
      expect(screen.getByText('100/100')).toBeInTheDocument();
    });
  });

  test('allows CSV data editing', async () => {
    renderCampaignDetail();

    // Navigate to CSV import step
    await waitFor(() => {
      expect(screen.getByText('解锁钱包')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/输入密码/), 'password123');
    await user.click(screen.getByText('解锁'));

    await waitFor(() => {
      expect(screen.getByText('导入CSV')).toBeInTheDocument();
    });

    // Should show edit capabilities after import
    await waitFor(() => {
      expect(screen.getByText('编辑')).toBeInTheDocument();
      expect(screen.getByText('删除')).toBeInTheDocument();
    });
  });

  test('handles contract deployment in progress', async () => {
    const deployingCampaign = { ...mockCampaign, status: 'CREATED' as const };
    mockElectronAPI.campaign.getById.mockResolvedValue(deployingCampaign);

    renderCampaignDetail();

    await waitFor(() => {
      expect(screen.getByText('CREATED')).toBeInTheDocument();
      expect(screen.getByText(/合约部署中/)).toBeInTheDocument();
    });
  });
});