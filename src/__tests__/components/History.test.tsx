import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { jest } from '@jest/globals';
import History from '../../renderer/src/pages/History';

// Mock React Router's useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// Mock Electron API
const mockElectronAPI = {
  campaign: {
    list: jest.fn(),
  },
  file: {
    exportReport: jest.fn(),
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
const mockCampaigns = [
  {
    id: '1',
    name: 'Test Campaign 1',
    chain: '1',
    tokenAddress: '0x1234567890123456789012345678901234567890',
    status: 'COMPLETED' as const,
    totalRecipients: 100,
    completedRecipients: 100,
    walletAddress: '0x1234567890123456789012345678901234567890',
    contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T11:45:00Z'
  },
  {
    id: '2',
    name: 'Test Campaign 2',
    chain: '137',
    tokenAddress: '0x9876543210987654321098765432109876543210',
    status: 'SENDING' as const,
    totalRecipients: 200,
    completedRecipients: 150,
    walletAddress: '0x9876543210987654321098765432109876543210',
    contractAddress: '0x1234567890123456789012345678901234567890',
    createdAt: '2024-01-14T09:15:00Z',
    updatedAt: '2024-01-14T10:30:00Z'
  },
  {
    id: '3',
    name: 'Test Campaign 3',
    chain: '56',
    tokenAddress: '0xfedcbafedcbafedcbafedcbafedcbafedcbafedc',
    status: 'READY' as const,
    totalRecipients: 50,
    completedRecipients: 0,
    walletAddress: '0xfedcbafedcbafedcbafedcbafedcbafedcbafedc',
    contractAddress: '0x5678905678905678905678905678905678905678',
    createdAt: '2024-01-13T14:20:00Z',
    updatedAt: '2024-01-13T14:20:00Z'
  },
  {
    id: '4',
    name: 'Failed Campaign',
    chain: '250',
    tokenAddress: '0x1111111111111111111111111111111111111111',
    status: 'FAILED' as const,
    totalRecipients: 75,
    completedRecipients: 25,
    walletAddress: '0x1111111111111111111111111111111111111111',
    contractAddress: '0x2222222222222222222222222222222222222222',
    createdAt: '2024-01-12T08:45:00Z',
    updatedAt: '2024-01-12T09:30:00Z'
  },
  {
    id: '5',
    name: 'Paused Campaign',
    chain: '43114',
    tokenAddress: '0x3333333333333333333333333333333333333333',
    status: 'PAUSED' as const,
    totalRecipients: 80,
    completedRecipients: 40,
    walletAddress: '0x3333333333333333333333333333333333333333',
    contractAddress: '0x4444444444444444444444444444444444444444',
    createdAt: '2024-01-11T16:20:00Z',
    updatedAt: '2024-01-11T17:10:00Z'
  }
];

describe('History Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.campaign.list.mockResolvedValue(mockCampaigns);
    mockElectronAPI.file.exportReport.mockResolvedValue({
      success: true,
      filePath: '/path/to/export.csv'
    });
  });

  const renderHistory = () => {
    return render(
      <MockRouter>
        <History />
      </MockRouter>
    );
  };

  test('renders history page with loading state', async () => {
    mockElectronAPI.campaign.list.mockImplementation(() => new Promise(() => {}));

    renderHistory();

    expect(screen.getByText('历史活动')).toBeInTheDocument();
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  test('renders history with campaign data', async () => {
    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('历史活动')).toBeInTheDocument();
      expect(screen.getByText('Test Campaign 1')).toBeInTheDocument();
      expect(screen.getByText('Test Campaign 2')).toBeInTheDocument();
      expect(screen.getByText('Test Campaign 3')).toBeInTheDocument();
    });
  });

  test('shows statistics cards', async () => {
    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('总活动数')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('已完成')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('进行中')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // READY + SENDING + PAUSED
      expect(screen.getByText('总地址数')).toBeInTheDocument();
      expect(screen.getByText('505')).toBeInTheDocument(); // 100 + 200 + 50 + 75 + 80
    });
  });

  test('displays correct status badges', async () => {
    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('已完成')).toBeInTheDocument();
      expect(screen.getByText('发送中')).toBeInTheDocument();
      expect(screen.getByText('就绪')).toBeInTheDocument();
      expect(screen.getByText('失败')).toBeInTheDocument();
      expect(screen.getByText('已暂停')).toBeInTheDocument();
    });
  });

  test('displays correct chain names', async () => {
    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
      expect(screen.getByText('Polygon')).toBeInTheDocument();
      expect(screen.getByText('BSC')).toBeInTheDocument();
      expect(screen.getByText('Fantom')).toBeInTheDocument();
      expect(screen.getByText('Avalanche')).toBeInTheDocument();
    });
  });

  test('shows filter and search controls', async () => {
    renderHistory();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('输入活动名称...')).toBeInTheDocument();
      expect(screen.getByText('状态筛选')).toBeInTheDocument();
      expect(screen.getByText('排序方式')).toBeInTheDocument();
      expect(screen.getByText('排序顺序')).toBeInTheDocument();
    });
  });

  test('filters by status', async () => {
    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('Test Campaign 1')).toBeInTheDocument();
    });

    // Filter by COMPLETED status
    const statusFilter = screen.getByText('状态筛选');
    await user.selectOptions(statusFilter, 'COMPLETED');

    await waitFor(() => {
      expect(screen.getByText('Test Campaign 1')).toBeInTheDocument();
      expect(screen.queryByText('Test Campaign 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Test Campaign 3')).not.toBeInTheDocument();
    });
  });

  test('searches by campaign name', async () => {
    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('Test Campaign 1')).toBeInTheDocument();
    });

    // Search for specific campaign
    const searchInput = screen.getByPlaceholderText('输入活动名称...');
    await user.type(searchInput, 'Test Campaign 1');

    await waitFor(() => {
      expect(screen.getByText('Test Campaign 1')).toBeInTheDocument();
      expect(screen.queryByText('Test Campaign 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Test Campaign 3')).not.toBeInTheDocument();
    });
  });

  test('sorts by different fields', async () => {
    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('Test Campaign 1')).toBeInTheDocument();
    });

    // Sort by name
    const sortBySelect = screen.getByText('排序方式');
    await user.selectOptions(sortBySelect, 'name');

    await waitFor(() => {
      expect(screen.getByText('Test Campaign 1')).toBeInTheDocument();
    });
  });

  test('changes sort order', async () => {
    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('Test Campaign 1')).toBeInTheDocument();
    });

    // Change sort order
    const sortOrderSelect = screen.getByText('排序顺序');
    await user.selectOptions(sortOrderSelect, 'asc');

    await waitFor(() => {
      expect(screen.getByText('Test Campaign 1')).toBeInTheDocument();
    });
  });

  test('shows progress bars for campaigns with recipients', async () => {
    renderHistory();

    await waitFor(() => {
      // Check if progress elements exist
      const progressBars = document.querySelectorAll('.bg-green-500');
      expect(progressBars.length).toBeGreaterThan(0);
    });
  });

  test('shows export buttons for completed campaigns', async () => {
    renderHistory();

    await waitFor(() => {
      // Should show CSV and JSON export buttons for completed campaigns
      const exportButtons = screen.getAllByText('CSV');
      expect(exportButtons.length).toBeGreaterThan(0);
    });
  });

  test('exports CSV report', async () => {
    renderHistory();

    await waitFor(() => {
      const csvButton = screen.getByText('CSV');
      expect(csvButton).toBeInTheDocument();
    });

    await user.click(screen.getByText('CSV'));

    await waitFor(() => {
      expect(mockElectronAPI.file.exportReport).toHaveBeenCalledWith('1', 'csv');
    });
  });

  test('exports JSON report', async () => {
    renderHistory();

    await waitFor(() => {
      const jsonButton = screen.getByText('JSON');
      expect(jsonButton).toBeInTheDocument();
    });

    await user.click(screen.getByText('JSON'));

    await waitFor(() => {
      expect(mockElectronAPI.file.exportReport).toHaveBeenCalledWith('1', 'json');
    });
  });

  test('navigates to campaign detail', async () => {
    renderHistory();

    await waitFor(() => {
      const detailButton = screen.getByText('详情');
      expect(detailButton).toBeInTheDocument();
    });

    await user.click(screen.getByText('详情'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/campaign/1');
    });
  });

  test('handles create new campaign navigation', async () => {
    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('创建新活动')).toBeInTheDocument();
    });

    await user.click(screen.getByText('创建新活动'));

    expect(mockNavigate).toHaveBeenCalledWith('/campaign/create');
  });

  test('shows completion percentages', async () => {
    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument(); // Campaign 1: 100/100
      expect(screen.getByText('75%')).toBeInTheDocument();  // Campaign 2: 150/200
      expect(screen.getByText('0%')).toBeInTheDocument();   // Campaign 3: 0/50
    });
  });

  test('handles empty campaign list', async () => {
    mockElectronAPI.campaign.list.mockResolvedValue([]);

    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('暂无符合条件的活动记录')).toBeInTheDocument();
      expect(screen.getByText('创建第一个活动')).toBeInTheDocument();
    });
  });

  test('shows wallet addresses', async () => {
    renderHistory();

    await waitFor(() => {
      // Should show truncated wallet addresses
      expect(screen.getByText(/0x1234\.\.\./)).toBeInTheDocument();
    });
  });

  test('displays table headers correctly', async () => {
    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('活动名称')).toBeInTheDocument();
      expect(screen.getByText('状态')).toBeInTheDocument();
      expect(screen.getByText('区块链')).toBeInTheDocument();
      expect(screen.getByText('收币地址')).toBeInTheDocument();
      expect(screen.getByText('完成进度')).toBeInTheDocument();
      expect(screen.getByText('创建时间')).toBeInTheDocument();
      expect(screen.getByText('操作')).toBeInTheDocument();
    });
  });

  test('handles export failure', async () => {
    mockElectronAPI.file.exportReport.mockResolvedValue({
      success: false,
      error: 'Export failed'
    });

    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('CSV')).toBeInTheDocument();
    });

    await user.click(screen.getByText('CSV'));

    await waitFor(() => {
      expect(screen.getByText('导出失败')).toBeInTheDocument();
    });
  });

  test('shows mobile responsive view', async () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    renderHistory();

    await waitFor(() => {
      // Mobile view should show different layout
      expect(screen.getByText('Test Campaign 1')).toBeInTheDocument();
    });
  });

  test('shows creation dates in correct format', async () => {
    renderHistory();

    await waitFor(() => {
      // Should show formatted dates
      expect(screen.getByText('1/15/2024')).toBeInTheDocument();
      expect(screen.getByText('1/14/2024')).toBeInTheDocument();
      expect(screen.getByText('1/13/2024')).toBeInTheDocument();
    });
  });

  test('filters by multiple criteria', async () => {
    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('Test Campaign 1')).toBeInTheDocument();
    });

    // Apply search and status filter together
    await user.type(screen.getByPlaceholderText('输入活动名称...'), 'Test');

    const statusFilter = screen.getByText('状态筛选');
    await user.selectOptions(statusFilter, 'COMPLETED');

    await waitFor(() => {
      expect(screen.getByText('Test Campaign 1')).toBeInTheDocument();
      expect(screen.queryByText('Test Campaign 2')).not.toBeInTheDocument();
    });
  });
});