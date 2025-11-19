import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { jest } from '@jest/globals';
import Dashboard from '../../renderer/src/pages/Dashboard';

// Mock Electron API
const mockElectronAPI = {
  campaign: {
    list: jest.fn(),
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
  }
];

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.campaign.list.mockResolvedValue(mockCampaigns);
  });

  const renderDashboard = () => {
    return render(
      <MockRouter>
        <Dashboard />
      </MockRouter>
    );
  };

  test('renders dashboard with loading state', () => {
    mockElectronAPI.campaign.list.mockImplementation(() => new Promise(() => {}));

    renderDashboard();

    expect(screen.getByText('仪表盘')).toBeInTheDocument();
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  test('renders dashboard with campaign data', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('仪表盘')).toBeInTheDocument();
    });

    // Check statistics cards
    expect(screen.getByText('总活动数')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('总收币地址')).toBeInTheDocument();
    expect(screen.getByText('350')).toBeInTheDocument();
    expect(screen.getByText('已发送')).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
  });

  test('displays quick action buttons', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('创建新活动')).toBeInTheDocument();
      expect(screen.getByText('查看历史')).toBeInTheDocument();
      expect(screen.getByText('系统设置')).toBeInTheDocument();
    });
  });

  test('shows active campaigns section', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('🚀 进行中的活动')).toBeInTheDocument();
    });

    // Should show active campaigns (READY and SENDING)
    expect(screen.getByText('Test Campaign 2')).toBeInTheDocument();
    expect(screen.getByText('Test Campaign 3')).toBeInTheDocument();
    expect(screen.getByText('Test Campaign 1')).not.toBeVisible(); // Completed campaign shouldn't be in active section
  });

  test('shows recent campaigns table', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('📋 最近活动')).toBeInTheDocument();
    });

    // Check table headers
    expect(screen.getByText('活动名称')).toBeInTheDocument();
    expect(screen.getByText('状态')).toBeInTheDocument();
    expect(screen.getByText('区块链')).toBeInTheDocument();
    expect(screen.getByText('收币地址')).toBeInTheDocument();

    // Should show recent campaigns (limited to 5)
    expect(screen.getByText('Test Campaign 1')).toBeInTheDocument();
    expect(screen.getByText('Test Campaign 2')).toBeInTheDocument();
    expect(screen.getByText('Test Campaign 3')).toBeInTheDocument();
  });

  test('displays correct status badges', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('已完成')).toBeInTheDocument();
      expect(screen.getByText('发送中')).toBeInTheDocument();
      expect(screen.getByText('就绪')).toBeInTheDocument();
    });
  });

  test('displays correct chain names', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
      expect(screen.getByText('Polygon')).toBeInTheDocument();
      expect(screen.getByText('BSC')).toBeInTheDocument();
    });
  });

  test('navigates to create campaign on button click', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('创建新活动')).toBeInTheDocument();
    });

    const createButton = screen.getAllByText('创建新活动')[0]; // First button in header
    fireEvent.click(createButton);

    // Note: Navigation testing would require actual router implementation
    // This test just verifies the click handler exists
  });

  test('shows progress bars for active campaigns', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Test Campaign 2')).toBeInTheDocument();
    });

    // Check if progress bar elements exist
    const progressBars = document.querySelectorAll('[role="progressbar"], .bg-green-500');
    expect(progressBars.length).toBeGreaterThan(0);
  });

  test('handles empty campaign list', async () => {
    mockElectronAPI.campaign.list.mockResolvedValue([]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('暂无进行中的活动')).toBeInTheDocument();
      expect(screen.getByText('创建第一个活动')).toBeInTheDocument();
    });
  });

  test('displays correct completion percentages', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument(); // Campaign 2: 150/200 = 75%
    });
  });

  test('shows view all buttons for sections', async () => {
    renderDashboard();

    await waitFor(() => {
      const viewAllButtons = screen.getAllByText('查看全部 →');
      expect(viewAllButtons.length).toBe(2); // One for active campaigns, one for recent campaigns
    });
  });
});