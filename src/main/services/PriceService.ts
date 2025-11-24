import axios from 'axios';


export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  marketCap: number;
  volume24h: number;
  lastUpdated: number;
}


export interface NetworkConfig {
  name: string;
  chainId: number;
  currency: string;
  nativeTokenSymbol: string;
  coingeckoId: string;
}

export class PriceService {
  private db: any;
  private priceCache: Map<string, PriceData> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  // Supported networks
  private readonly networks: NetworkConfig[] = [
    { name: 'ethereum', chainId: 1, currency: 'USD', nativeTokenSymbol: 'ETH', coingeckoId: 'ethereum' },
    { name: 'polygon', chainId: 137, currency: 'USD', nativeTokenSymbol: 'POL', coingeckoId: 'polygon-ecosystem-token' },
    { name: 'arbitrum', chainId: 42161, currency: 'USD', nativeTokenSymbol: 'ETH', coingeckoId: 'ethereum' },
    { name: 'optimism', chainId: 10, currency: 'USD', nativeTokenSymbol: 'ETH', coingeckoId: 'ethereum' },
    { name: 'base', chainId: 8453, currency: 'USD', nativeTokenSymbol: 'ETH', coingeckoId: 'ethereum' },
    { name: 'bsc', chainId: 56, currency: 'USD', nativeTokenSymbol: 'BNB', coingeckoId: 'binancecoin' },
    { name: 'avalanche', chainId: 43114, currency: 'USD', nativeTokenSymbol: 'AVAX', coingeckoId: 'avalanche-2' },
    { name: 'solana', chainId: 0, currency: 'USD', nativeTokenSymbol: 'SOL', coingeckoId: 'solana' },
  ];

  constructor(database: any) {
    this.db = database.getDatabase();
    this.initializePriceTables();
    this.startPriceUpdates();
  }

  private initializePriceTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        price REAL NOT NULL,
        change_24h REAL,
        change_percent_24h REAL,
        market_cap REAL,
        volume_24h REAL,
        timestamp INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_price_symbol ON price_history(symbol);
      CREATE INDEX IF NOT EXISTS idx_price_timestamp ON price_history(timestamp);
    `);
  }

  private startPriceUpdates(): void {
    console.log('[PriceService] Starting price updates...');
    // Update prices every 3 minutes (180 seconds)
    this.updateInterval = setInterval(async () => {
      try {
        console.log('[PriceService] Running scheduled price update...');
        await this.updateAllPrices();
      } catch (error) {
        console.error('[PriceService] Price update failed:', error);
      }
    }, 180000);

    // Initial price update
    console.log('[PriceService] Running initial price update...');
    this.updateAllPrices().catch(error => {
      console.error('[PriceService] Initial price update failed:', error);
    });
  }

  private async updateAllPrices(): Promise<void> {
    const coinIds = this.networks.map(n => n.coingeckoId).filter((id, index, self) => self.indexOf(id) === index);
    console.log('[PriceService] Fetching prices for coins:', coinIds);

    try {
      const url = 'https://api.coingecko.com/api/v3/simple/price';
      const params = {
        ids: coinIds.join(','),
        vs_currencies: 'usd',
      };
      console.log('[PriceService] Making request to:', url, 'with params:', params);

      const response = await axios.get(url, {
        params,
        timeout: 10000,
      });

      console.log('[PriceService] Received response from CoinGecko:', response.data);
      const timestamp = Math.floor(Date.now() / 1000);

      this.networks.forEach(network => {
        const coinData = response.data[network.coingeckoId];
        if (coinData && typeof coinData.usd === 'number' && coinData.usd > 0) {
          const priceData: PriceData = {
            symbol: network.nativeTokenSymbol,
            price: coinData.usd,
            change24h: 0,
            changePercent24h: 0,
            marketCap: 0,
            volume24h: 0,
            lastUpdated: timestamp,
          };

          console.log(`[PriceService] Updating price for ${network.nativeTokenSymbol}: $${coinData.usd}`);
          this.priceCache.set(network.nativeTokenSymbol, priceData);
          this.savePriceToDatabase(priceData);
        } else if (coinData) {
          console.warn(`[PriceService] Invalid price data for ${network.nativeTokenSymbol}:`, coinData);
        } else {
          console.warn(`[PriceService] No data returned for ${network.nativeTokenSymbol} (${network.coingeckoId})`);
        }
      });
      console.log('[PriceService] Price cache now has', this.priceCache.size, 'entries');
    } catch (error) {
      console.error('[PriceService] Failed to fetch prices from CoinGecko:', error);
      // Fallback to cached prices
    }
  }

  
  private savePriceToDatabase(priceData: PriceData): void {
    try {
      // Double-check price validity before database insertion
      if (typeof priceData.price !== 'number' || priceData.price < 0 || !isFinite(priceData.price)) {
        console.warn(`Invalid price value for ${priceData.symbol}:`, priceData.price);
        return;
      }

      const stmt = this.db.prepare(`
        INSERT INTO price_history (symbol, price, change_24h, change_percent_24h, market_cap, volume_24h, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        priceData.symbol,
        priceData.price,
        priceData.change24h,
        priceData.changePercent24h,
        priceData.marketCap,
        priceData.volume24h,
        priceData.lastUpdated
      );
    } catch (error) {
      console.error('Failed to save price to database:', error);
    }
  }

  async getPrice(symbol: string): Promise<number> {
    const cachedPrice = this.priceCache.get(symbol.toUpperCase());
    if (cachedPrice) {
      return cachedPrice.price;
    }

    // Fallback to database
    try {
      const result = this.db.prepare(`
        SELECT price FROM price_history
        WHERE symbol = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `).get(symbol.toUpperCase()) as { price: number } | undefined;

      return result ? result.price : 0;
    } catch (error) {
      console.error('Failed to get price from database:', error);
      return 0;
    }
  }

  async getPriceData(symbol: string): Promise<PriceData | null> {
    const cachedPrice = this.priceCache.get(symbol.toUpperCase());
    if (cachedPrice) {
      return cachedPrice;
    }

    // Fallback to database
    try {
      const result = this.db.prepare(`
        SELECT * FROM price_history
        WHERE symbol = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `).get(symbol.toUpperCase()) as {
        symbol: string;
        price: number;
        change_24h: number;
        change_percent_24h: number;
        market_cap: number;
        volume_24h: number;
        timestamp: number;
      } | undefined;

      if (result) {
        return {
          symbol: result.symbol,
          price: result.price,
          change24h: result.change_24h,
          changePercent24h: result.change_percent_24h,
          marketCap: result.market_cap,
          volume24h: result.volume_24h,
          lastUpdated: result.timestamp,
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get price data from database:', error);
      return null;
    }
  }

  
  async getPricesForSymbols(symbols: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};

    for (const symbol of symbols) {
      const price = await this.getPrice(symbol);
      prices[symbol] = price;
    }

    return prices;
  }

  async getTokenPriceUSD(tokenAddress: string, network: string): Promise<number> {
    try {
      // For now, return the native token price
      // In a real implementation, you'd query DEX prices or token price APIs
      const networkConfig = this.networks.find(n => n.name === network);
      if (networkConfig) {
        return await this.getPrice(networkConfig.nativeTokenSymbol);
      }
      return 0;
    } catch (error) {
      console.error('Failed to get token price:', error);
      return 0;
    }
  }

  async getPriceHistory(symbol: string, hours: number = 24): Promise<Array<{ timestamp: number; price: number }>> {
    try {
      const since = Math.floor(Date.now() / 1000) - (hours * 3600);

      const results = this.db.prepare(`
        SELECT timestamp, price FROM price_history
        WHERE symbol = ? AND timestamp >= ?
        ORDER BY timestamp ASC
      `).all(symbol.toUpperCase(), since) as Array<{ timestamp: number; price: number }>;

      return results;
    } catch (error) {
      console.error('Failed to get price history:', error);
      return [];
    }
  }

  calculateGasCostUSD(gasLimit: string, gasPrice: string, ethPrice: number): number {
    try {
      const gasLimitWei = BigInt(gasLimit);
      const gasPriceWei = BigInt(Math.floor(parseFloat(gasPrice) * 1e9));
      const gasCostWei = gasLimitWei * gasPriceWei;
      const gasCostEth = Number(gasCostWei) / 1e18;
      return gasCostEth * ethPrice;
    } catch (error) {
      console.error('Failed to calculate gas cost:', error);
      return 0;
    }
  }

  getNetworkConfig(chainId: number): NetworkConfig | null {
    return this.networks.find(n => n.chainId === chainId) || null;
  }

  getNetworkConfigByName(name: string): NetworkConfig | null {
    return this.networks.find(n => n.name === name) || null;
  }

  async convertToUSD(amount: string, tokenSymbol: string): Promise<number> {
    try {
      const price = await this.getPrice(tokenSymbol);
      const amountNumber = parseFloat(amount);
      return amountNumber * price;
    } catch (error) {
      console.error('Failed to convert to USD:', error);
      return 0;
    }
  }

  async convertFromUSD(usdAmount: number, tokenSymbol: string): Promise<number> {
    try {
      const price = await this.getPrice(tokenSymbol);
      if (price === 0) return 0;
      return usdAmount / price;
    } catch (error) {
      console.error('Failed to convert from USD:', error);
      return 0;
    }
  }

  getSupportedNetworks(): NetworkConfig[] {
    return [...this.networks];
  }

  clearCache(): void {
    this.priceCache.clear();
  }

  forceUpdate(): void {
    this.clearCache();
    this.updateAllPrices();
  }

  /**
   * Save historical price data to database
   */
  async saveHistoricalPrice(symbol: string, price: number, change24h: number): Promise<void> {
    try {
      this.db.prepare(`
        INSERT INTO price_history (symbol, price, change_24h, change_percent_24h, market_cap, volume_24h, timestamp)
        VALUES (?, ?, ?, ?, 0, 0, ?)
      `).run(
        symbol.toUpperCase(),
        price,
        change24h,
        0, // changePercent24h - calculate if needed
        Date.now()
      );
    } catch (error) {
      console.error('Failed to save historical price:', error);
      throw new Error(`Failed to save historical price: ${error}`);
    }
  }

  /**
   * Get historical prices for a symbol
   */
  async getHistoricalPrices(symbol: string, days: number): Promise<Array<{ symbol: string; price: number; change: number; timestamp: string }>> {
    try {
      const results = this.db.prepare(`
        SELECT symbol, price, change_24h as change, timestamp
        FROM price_history
        WHERE symbol = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(symbol.toUpperCase(), days) as Array<{ symbol: string; price: number; change: number; timestamp: number }>;

      // Convert timestamp to ISO string
      return results.map(r => ({
        ...r,
        timestamp: new Date(r.timestamp).toISOString()
      }));
    } catch (error) {
      console.error('Failed to get historical prices:', error);
      return [];
    }
  }

  stopUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  async getPriceSummary(): Promise<{
    totalValue: number;
    tokenPrices: Record<string, PriceData>;
    lastUpdated: number;
  }> {
    const tokenPrices: Record<string, PriceData> = {};

    for (const [symbol, priceData] of this.priceCache) {
      tokenPrices[symbol] = priceData;
    }

    const totalValue = Object.values(tokenPrices).reduce((sum, price) => sum + price.price, 0);

    return {
      totalValue,
      tokenPrices,
      lastUpdated: Math.floor(Date.now() / 1000),
    };
  }

  async exportPriceData(symbols: string[], days: number = 30): Promise<string> {
    try {
      const since = Math.floor(Date.now() / 1000) - (days * 24 * 3600);
      const exportData: any[] = [];

      for (const symbol of symbols) {
        const results = this.db.prepare(`
          SELECT symbol, price, change_24h, change_percent_24h, timestamp
          FROM price_history
          WHERE symbol = ? AND timestamp >= ?
          ORDER BY timestamp ASC
        `).all(symbol.toUpperCase(), since);

        exportData.push(...results);
      }

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export price data:', error);
      return '[]';
    }
  }
}