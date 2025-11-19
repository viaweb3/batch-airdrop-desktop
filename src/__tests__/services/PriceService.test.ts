import { PriceService } from '../../main/services/PriceService';
import { DatabaseManager } from '../../main/database/schema';
import { createTempTestDir, cleanupTempDir, createMockPriceData, createMockGasPrice } from '../utils/testUtils';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PriceService', () => {
  let priceService: PriceService;
  let databaseManager: DatabaseManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = createTempTestDir();
    databaseManager = new DatabaseManager(testDir);
    priceService = new PriceService(databaseManager);

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    cleanupTempDir(testDir);
  });

  describe('Price Retrieval', () => {
    test('should get single price from API successfully', async () => {
      const mockPrice = 2000.50;
      mockedAxios.get.mockResolvedValue({
        data: {
          ethereum: { usd: mockPrice }
        }
      });

      const result = await priceService.getPrice('ETH');

      expect(result.symbol).toBe('ETH');
      expect(result.price).toBe(mockPrice);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/simple/price',
        {
          params: {
            ids: 'ethereum',
            vs_currencies: 'usd',
            include_24hr_change: true
          }
        }
      );
    });

    test('should get price from cache when available', async () => {
      const symbol = 'ETH';
      const mockPrice = 2000.50;

      // Mock API response
      mockedAxios.get.mockResolvedValue({
        data: {
          ethereum: { usd: mockPrice }
        }
      });

      // First call - should hit API
      const result1 = await priceService.getPrice(symbol);
      expect(result1.price).toBe(mockPrice);

      // Second call - should use cache
      const result2 = await priceService.getPrice(symbol);
      expect(result2.price).toBe(mockPrice);

      // Should only call API once due to caching
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    test('should handle API error for price retrieval', async () => {
      const symbol = 'INVALID';
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      await expect(priceService.getPrice(symbol)).rejects.toThrow('Failed to fetch price');
    });

    test('should handle missing price in API response', async () => {
      const symbol = 'ETH';
      mockedAxios.get.mockResolvedValue({
        data: {} // Empty response
      });

      const result = await priceService.getPrice(symbol);
      expect(result.symbol).toBe(symbol);
      expect(result.price).toBe(0);
    });

    test('should map symbol to coin ID correctly', async () => {
      const mockPrice = 1.20;
      mockedAxios.get.mockResolvedValue({
        data: {
          'matic-network': { usd: mockPrice }
        }
      });

      const result = await priceService.getPrice('MATIC');

      expect(result.symbol).toBe('MATIC');
      expect(result.price).toBe(mockPrice);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            ids: 'matic-network'
          })
        })
      );
    });
  });

  describe('Batch Price Retrieval', () => {
    test('should get multiple prices successfully', async () => {
      const symbols = ['ETH', 'BTC', 'MATIC'];
      const mockPrices = {
        ethereum: { usd: 2000.50, usd_24h_change: 2.5 },
        bitcoin: { usd: 45000.00, usd_24h_change: -1.2 },
        'matic-network': { usd: 1.20, usd_24h_change: 5.8 }
      };

      mockedAxios.get.mockResolvedValue({
        data: mockPrices
      });

      const results = await priceService.getPricesForSymbols(symbols);

      expect(results).toEqual({
        ETH: 2000.50,
        BTC: 45000.00,
        MATIC: 1.20
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/simple/price',
        {
          params: {
            ids: 'ethereum,bitcoin,matic-network',
            vs_currencies: 'usd',
            include_24hr_change: true
          }
        }
      );
    });

    test('should handle empty symbol array', async () => {
      const results = await priceService.getPricesForSymbols([]);
      expect(results).toEqual({});
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    test('should handle mixed valid and invalid symbols', async () => {
      const symbols = ['ETH', 'INVALID'];
      const mockPrices = {
        ethereum: { usd: 2000.50 }
      };

      mockedAxios.get.mockResolvedValue({
        data: mockPrices
      });

      const results = await priceService.getPricesForSymbols(symbols);

      expect(results).toEqual({
        ETH: 2000.50,
        INVALID: 0
      });
    });
  });

  describe('Gas Price Retrieval', () => {
    test('should get Ethereum gas price successfully', async () => {
      const mockGasPrice = {
        suggestBaseFee: '30.0',
        gasPriceRatio: '1.0',
        lowSuggestPriorityFee: '1.0',
        mediumSuggestPriorityFee: '2.0',
        highSuggestPriorityFee: '3.0'
      };

      mockedAxios.get.mockResolvedValue({
        data: {
          success: true,
          result: mockGasPrice
        }
      });

      const result = await priceService.getGasPrice('ethereum');

      expect(result.network).toBe('ethereum');
      expect(result.gasPrice).toBe('31.0'); // 30.0 + 1.0
      expect(result.timestamp).toBeDefined();
    });

    test('should get Polygon gas price successfully', async () => {
      const mockGasPrice = {
        safeLow: { maxPriorityFee: 30, maxFee: 30 },
        standard: { maxPriorityFee: 30, maxFee: 31 },
        fast: { maxPriorityFee: 35, maxFee: 36 }
      };

      mockedAxios.get.mockResolvedValue({
        data: mockGasPrice
      });

      const result = await priceService.getGasPrice('polygon');

      expect(result.network).toBe('polygon');
      expect(result.gasPrice).toBe('61'); // 30 + 31
      expect(result.timestamp).toBeDefined();
    });

    test('should handle unsupported network for gas price', async () => {
      const result = await priceService.getGasPrice('unsupported');

      expect(result.network).toBe('unsupported');
      expect(result.gasPrice).toBe('0');
      expect(result.timestamp).toBeDefined();
    });

    test('should handle API error for gas price', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      const result = await priceService.getGasPrice('ethereum');

      expect(result.network).toBe('ethereum');
      expect(result.gasPrice).toBe('0');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('Price Summary', () => {
    test('should get comprehensive price summary', async () => {
      const mockPrices = {
        ethereum: { usd: 2000.50, usd_24h_change: 2.5 },
        bitcoin: { usd: 45000.00, usd_24h_change: -1.2 },
        'matic-network': { usd: 1.20, usd_24h_change: 5.8 }
      };

      const mockEthGas = {
        success: true,
        result: {
          suggestBaseFee: '30.0',
          gasPriceRatio: '1.0',
          mediumSuggestPriorityFee: '2.0'
        }
      };

      const mockPolygonGas = {
        safeLow: { maxPriorityFee: 30, maxFee: 30 },
        standard: { maxPriorityFee: 30, maxFee: 31 }
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockPrices }) // Price call
        .mockResolvedValueOnce({ data: mockEthGas }) // Ethereum gas call
        .mockResolvedValueOnce({ data: mockPolygonGas }); // Polygon gas call

      const summary = await priceService.getPriceSummary();

      expect(summary.prices).toEqual({
        ETH: 2000.50,
        BTC: 45000.00,
        MATIC: 1.20
      });

      expect(summary.changes).toEqual({
        ETH: 2.5,
        BTC: -1.2,
        MATIC: 5.8
      });

      expect(summary.gasPrices).toEqual({
        ethereum: '32.0', // 30.0 + 2.0
        polygon: '61'    // 30 + 31
      });

      expect(summary.timestamp).toBeDefined();
      expect(summary.lastUpdated).toBeDefined();
    });

    test('should handle partial data in price summary', async () => {
      // Mock only prices, gas prices fail
      const mockPrices = {
        ethereum: { usd: 2000.50, usd_24h_change: 2.5 }
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockPrices }) // Price call
        .mockRejectedValueOnce(new Error('Gas API Error')) // Ethereum gas call fails
        .mockRejectedValueOnce(new Error('Gas API Error')); // Polygon gas call fails

      const summary = await priceService.getPriceSummary();

      expect(summary.prices).toEqual({
        ETH: 2000.50
      });

      expect(summary.changes).toEqual({
        ETH: 2.5
      });

      expect(summary.gasPrices).toEqual({
        ethereum: '0',
        polygon: '0'
      });
    });
  });

  describe('Auto Update Mechanism', () => {
    beforeEach(() => {
      // Mock setInterval and clearInterval
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should start auto update mechanism', () => {
      const mockPrices = { ethereum: { usd: 2000.50 } };
      mockedAxios.get.mockResolvedValue({ data: mockPrices });

      priceService.startAutoUpdate(5000); // 5 second interval

      // Fast forward time
      jest.advanceTimersByTime(5000);

      expect(mockedAxios.get).toHaveBeenCalled();

      priceService.stopAutoUpdate();
    });

    test('should stop auto update mechanism', () => {
      const mockPrices = { ethereum: { usd: 2000.50 } };
      mockedAxios.get.mockResolvedValue({ data: mockPrices });

      priceService.startAutoUpdate(5000);
      priceService.stopAutoUpdate();

      // Fast forward time - should not trigger update
      jest.advanceTimersByTime(5000);

      // Should still have the initial call from start
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    test('should handle update errors gracefully', () => {
      const mockPrices = { ethereum: { usd: 2000.50 } };
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockPrices })
        .mockRejectedValueOnce(new Error('Update Error'))
        .mockResolvedValueOnce({ data: mockPrices });

      priceService.startAutoUpdate(1000);

      // Fast forward through multiple intervals
      jest.advanceTimersByTime(3000);

      // Should continue despite errors
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);

      priceService.stopAutoUpdate();
    });
  });

  describe('Cache Management', () => {
    test('should expire cache after timeout', async () => {
      const symbol = 'ETH';
      const mockPrice = 2000.50;

      mockedAxios.get.mockResolvedValue({
        data: { ethereum: { usd: mockPrice } }
      });

      // First call
      await priceService.getPrice(symbol);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Wait for cache to expire (60 seconds + 1 second buffer)
      await new Promise(resolve => setTimeout(resolve, 61000));

      // Second call should hit API again
      await priceService.getPrice(symbol);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    test('should clear cache manually', async () => {
      const symbol = 'ETH';
      const mockPrice = 2000.50;

      mockedAxios.get.mockResolvedValue({
        data: { ethereum: { usd: mockPrice } }
      });

      // First call
      await priceService.getPrice(symbol);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Clear cache
      priceService.clearCache();

      // Second call should hit API again
      await priceService.getPrice(symbol);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Historical Data', () => {
    test('should save and retrieve historical price data', async () => {
      const symbol = 'ETH';
      const price = 2000.50;
      const change = 2.5;

      await priceService.saveHistoricalPrice(symbol, price, change);

      const history = await priceService.getHistoricalPrices(symbol, 1);

      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({
        symbol,
        price,
        change,
        timestamp: expect.any(String)
      });
    });

    test('should get historical prices for multiple days', async () => {
      const symbol = 'ETH';

      // Save multiple days of data
      for (let i = 0; i < 5; i++) {
        await priceService.saveHistoricalPrice(symbol, 2000 + i, i);
      }

      const history = await priceService.getHistoricalPrices(symbol, 7);

      expect(history).toHaveLength(5);
      expect(history[0].price).toBe(2004); // Most recent first
      expect(history[4].price).toBe(2000);
    });

    test('should limit historical data retrieval', async () => {
      const symbol = 'ETH';

      // Save more data than we'll request
      for (let i = 0; i < 10; i++) {
        await priceService.saveHistoricalPrice(symbol, 2000 + i, i);
      }

      const history = await priceService.getHistoricalPrices(symbol, 5);

      expect(history).toHaveLength(5);
    });
  });
});