// S&P 500 stocks by sector
const SP500_BY_SECTOR = {
  'Technology': [
    'AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'ADBE', 'CRM', 'CSCO', 'ACN', 'AMD',
    'INTC', 'IBM', 'QCOM', 'INTU', 'TXN', 'NOW', 'AMAT', 'ADI', 'LRCX', 'MU',
    'SNOW', 'PANW', 'PLTR', 'CRWD', 'ADSK', 'CDNS', 'SNPS', 'MCHP', 'KLAC', 'FTNT',
    'NXPI', 'ANSS', 'HPQ', 'APH', 'MPWR', 'NTAP', 'IT', 'GLW', 'ZBRA', 'KEYS',
    'GDDY', 'TYL', 'WDC', 'STX', 'GEN', 'SWKS', 'JNPR', 'FFIV', 'AKAM', 'ENPH'
  ],
  'Healthcare': [
    'UNH', 'LLY', 'JNJ', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'AMGN', 'ISRG',
    'SYK', 'VRTX', 'REGN', 'CVS', 'CI', 'ELV', 'ZTS', 'BSX', 'BDX', 'HUM',
    'GILD', 'MDT', 'BMY', 'IQV', 'EW', 'DXCM', 'IDXX', 'HCA', 'RMD', 'A',
    'GEHC', 'CNC', 'MRNA', 'ALGN', 'WAT', 'MTD', 'BIIB', 'ZBH', 'ILMN', 'STE',
    'LH', 'RVTY', 'HOLX', 'PODD', 'DGX', 'MOH', 'BAX', 'CRL', 'TFX', 'VTRS'
  ],
  'Financial': [
    'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'BX', 'AXP', 'BLK',
    'SPGI', 'C', 'SCHW', 'CB', 'PGR', 'MMC', 'PLD', 'ICE', 'CME', 'AON',
    'USB', 'TFC', 'PNC', 'AJG', 'BK', 'COF', 'FI', 'AFL', 'AIG', 'MET',
    'ALL', 'TRV', 'PRU', 'DFS', 'AMP', 'HIG', 'MSCI', 'WTW', 'MTB', 'TROW',
    'STT', 'BRO', 'SYF', 'FITB', 'HBAN', 'RF', 'CFG', 'KEY', 'NTRS', 'EG'
  ],
  'Consumer Discretionary': [
    'AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX', 'LOW', 'TJX', 'BKNG', 'AZO',
    'CMG', 'ORLY', 'GM', 'MAR', 'HLT', 'F', 'ROST', 'YUM', 'DHI', 'LEN',
    'ABNB', 'LULU', 'GRMN', 'DECK', 'EBAY', 'TSCO', 'POOL', 'CCL', 'RCL', 'LVS',
    'WYNN', 'MGM', 'NCLH', 'EXPE', 'ULTA', 'DRI', 'GPC', 'BBY', 'KMX', 'TPR',
    'RL', 'APTV', 'WHR', 'NVR', 'PHM', 'BWA', 'MHK', 'HAS', 'LKQ', 'VFC'
  ],
  'Communication Services': [
    'GOOGL', 'META', 'NFLX', 'DIS', 'CMCSA', 'T', 'TMUS', 'VZ', 'CHTR', 'EA',
    'TTWO', 'OMC', 'IPG', 'NWSA', 'FOX', 'FOXA', 'MTCH', 'PARA', 'LYV', 'WBD'
  ],
  'Industrials': [
    'CAT', 'BA', 'RTX', 'UPS', 'HON', 'GE', 'ETN', 'LMT', 'DE', 'UNP',
    'ADP', 'MMM', 'NOC', 'SLB', 'EMR', 'ITW', 'GD', 'TDG', 'PH', 'WM',
    'CSX', 'NSC', 'CARR', 'PCAR', 'FDX', 'JCI', 'TT', 'CTAS', 'CMI', 'EOG',
    'RSG', 'ODFL', 'PAYX', 'VRSK', 'IR', 'AXON', 'DAL', 'UAL', 'LUV', 'ALK',
    'JBHT', 'EXPD', 'CHRW', 'URI', 'FAST', 'HUBB', 'AME', 'ROK', 'DOV', 'XYL'
  ],
  'Consumer Staples': [
    'WMT', 'PG', 'COST', 'KO', 'PEP', 'PM', 'MO', 'MDLZ', 'CL', 'GIS',
    'KMB', 'STZ', 'SYY', 'KHC', 'TSN', 'ADM', 'HSY', 'K', 'CHD', 'CAG',
    'MKC', 'CPB', 'HRL', 'SJM', 'LW', 'TAP', 'KDP', 'MNST', 'DG', 'DLTR',
    'EL', 'CLX'
  ],
  'Energy': [
    'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OXY', 'WMB',
    'KMI', 'HES', 'BKR', 'HAL', 'DVN', 'FANG', 'TRGP', 'EQT', 'MRO', 'OKE',
    'CTRA', 'APA'
  ],
  'Utilities': [
    'NEE', 'SO', 'DUK', 'CEG', 'SRE', 'AEP', 'D', 'VST', 'PCG', 'PEG',
    'EXC', 'XEL', 'ED', 'EIX', 'WEC', 'AWK', 'DTE', 'PPL', 'ES', 'FE',
    'AEE', 'ATO', 'CMS', 'CNP', 'NI', 'LNT', 'EVRG', 'PNW', 'AES', 'ETR'
  ],
  'Real Estate': [
    'PLD', 'AMT', 'EQIX', 'PSA', 'WELL', 'SPG', 'DLR', 'O', 'CCI', 'VICI',
    'SBAC', 'EXR', 'AVB', 'EQR', 'INVH', 'VTR', 'MAA', 'ARE', 'DOC', 'UDR',
    'ESS', 'BXP', 'CPT', 'CBRE', 'HST', 'REG', 'KIM', 'FRT', 'VNO'
  ],
  'Materials': [
    'LIN', 'APD', 'SHW', 'ECL', 'FCX', 'NEM', 'CTVA', 'DD', 'NUE', 'DOW',
    'VMC', 'MLM', 'BALL', 'STLD', 'AVY', 'ALB', 'AMCR', 'PKG', 'IP', 'CE',
    'CF', 'MOS', 'EMN', 'FMC', 'IFF'
  ]
};

// Market caps by sector (approximate in billions)
const MARKET_CAPS_BY_SECTOR = {
  'Technology': {
    'AAPL': 3450, 'MSFT': 3150, 'NVDA': 1750, 'AVGO': 650, 'ORCL': 350, 'ADBE': 230, 'CRM': 280, 'CSCO': 220, 'ACN': 210, 'AMD': 270,
    'INTC': 190, 'IBM': 180, 'QCOM': 200, 'INTU': 180, 'TXN': 180, 'NOW': 180, 'AMAT': 150, 'ADI': 110, 'LRCX': 120, 'MU': 110,
    'SNOW': 50, 'PANW': 95, 'PLTR': 65, 'CRWD': 75, 'ADSK': 45, 'CDNS': 80, 'SNPS': 85, 'MCHP': 45, 'KLAC': 75, 'FTNT': 65,
    'NXPI': 55, 'ANSS': 35, 'HPQ': 35, 'APH': 65, 'MPWR': 40, 'NTAP': 20, 'IT': 25, 'GLW': 30, 'ZBRA': 30, 'KEYS': 35,
    'GDDY': 15, 'TYL': 25, 'WDC': 20, 'STX': 15, 'GEN': 20, 'SWKS': 15, 'JNPR': 10, 'FFIV': 10, 'AKAM': 15, 'ENPH': 15
  },
  'Healthcare': {
    'UNH': 520, 'LLY': 780, 'JNJ': 390, 'ABBV': 340, 'MRK': 320, 'TMO': 220, 'ABT': 200, 'DHR': 190, 'AMGN': 150, 'ISRG': 160,
    'SYK': 120, 'VRTX': 120, 'REGN': 110, 'CVS': 90, 'CI': 100, 'ELV': 130, 'ZTS': 90, 'BSX': 130, 'BDX': 70, 'HUM': 70,
    'GILD': 110, 'MDT': 110, 'BMY': 110, 'IQV': 40, 'EW': 60, 'DXCM': 35, 'IDXX': 55, 'HCA': 75, 'RMD': 35, 'A': 45,
    'GEHC': 35, 'CNC': 30, 'MRNA': 45, 'ALGN': 25, 'WAT': 25, 'MTD': 35, 'BIIB': 35, 'ZBH': 20, 'ILMN': 20, 'STE': 25,
    'LH': 20, 'RVTY': 20, 'HOLX': 20, 'PODD': 15, 'DGX': 15, 'MOH': 12, 'BAX': 18, 'CRL': 12, 'TFX': 12, 'VTRS': 10
  },
  'Financial': {
    'JPM': 580, 'V': 580, 'MA': 430, 'BAC': 310, 'WFC': 210, 'GS': 150, 'MS': 145, 'BX': 140, 'AXP': 170, 'BLK': 130,
    'SPGI': 150, 'C': 130, 'SCHW': 130, 'CB': 90, 'PGR': 100, 'MMC': 110, 'PLD': 120, 'ICE': 80, 'CME': 85, 'AON': 75,
    'USB': 70, 'TFC': 55, 'PNC': 60, 'AJG': 50, 'BK': 50, 'COF': 55, 'FI': 85, 'AFL': 55, 'AIG': 50, 'MET': 50,
    'ALL': 45, 'TRV': 45, 'PRU': 40, 'DFS': 35, 'AMP': 40, 'HIG': 35, 'MSCI': 55, 'WTW': 30, 'MTB': 25, 'TROW': 25,
    'STT': 25, 'BRO': 25, 'SYF': 20, 'FITB': 20, 'HBAN': 15, 'RF': 15, 'CFG': 18, 'KEY': 15, 'NTRS': 15, 'EG': 12
  },
  'Consumer Discretionary': {
    'AMZN': 1850, 'TSLA': 950, 'HD': 380, 'MCD': 210, 'NKE': 130, 'SBUX': 110, 'LOW': 140, 'TJX': 120, 'BKNG': 140, 'AZO': 60,
    'CMG': 75, 'ORLY': 70, 'GM': 55, 'MAR': 75, 'HLT': 60, 'F': 45, 'ROST': 50, 'YUM': 40, 'DHI': 45, 'LEN': 40,
    'ABNB': 90, 'LULU': 50, 'GRMN': 35, 'DECK': 20, 'EBAY': 25, 'TSCO': 30, 'POOL': 15, 'CCL': 20, 'RCL': 25, 'LVS': 35,
    'WYNN': 10, 'MGM': 15, 'NCLH': 10, 'EXPE': 20, 'ULTA': 20, 'DRI': 20, 'GPC': 15, 'BBY': 18, 'KMX': 12, 'TPR': 10,
    'RL': 8, 'APTV': 20, 'WHR': 8, 'NVR': 25, 'PHM': 15, 'BWA': 5, 'MHK': 6, 'HAS': 8, 'LKQ': 10, 'VFC': 10
  },
  'Communication Services': {
    'GOOGL': 2100, 'META': 1400, 'NFLX': 310, 'DIS': 200, 'CMCSA': 160, 'T': 140, 'TMUS': 230, 'VZ': 170, 'CHTR': 50, 'EA': 40,
    'TTWO': 35, 'OMC': 15, 'IPG': 10, 'NWSA': 15, 'FOX': 18, 'FOXA': 18, 'MTCH': 10, 'PARA': 10, 'LYV': 25, 'WBD': 20
  },
  'Industrials': {
    'CAT': 170, 'BA': 140, 'RTX': 160, 'UPS': 120, 'HON': 150, 'GE': 180, 'ETN': 120, 'LMT': 120, 'DE': 130, 'UNP': 140,
    'ADP': 110, 'MMM': 60, 'NOC': 80, 'SLB': 60, 'EMR': 65, 'ITW': 75, 'GD': 70, 'TDG': 85, 'PH': 75, 'WM': 80,
    'CSX': 70, 'NSC': 55, 'CARR': 60, 'PCAR': 50, 'FDX': 70, 'JCI': 55, 'TT': 40, 'CTAS': 75, 'CMI': 40, 'EOG': 70,
    'RSG': 55, 'ODFL': 50, 'PAYX': 45, 'VRSK': 50, 'IR': 50, 'AXON': 50, 'DAL': 30, 'UAL': 20, 'LUV': 18, 'ALK': 8,
    'JBHT': 20, 'EXPD': 15, 'CHRW': 10, 'URI': 40, 'FAST': 40, 'HUBB': 35, 'AME': 40, 'ROK': 35, 'DOV': 25, 'XYL': 25
  },
  'Consumer Staples': {
    'WMT': 590, 'PG': 380, 'COST': 380, 'KO': 270, 'PEP': 240, 'PM': 180, 'MO': 90, 'MDLZ': 90, 'CL': 75, 'GIS': 35,
    'KMB': 45, 'STZ': 50, 'SYY': 40, 'KHC': 40, 'TSN': 25, 'ADM': 30, 'HSY': 35, 'K': 25, 'CHD': 25, 'CAG': 15,
    'MKC': 20, 'CPB': 12, 'HRL': 15, 'SJM': 12, 'LW': 10, 'TAP': 10, 'KDP': 45, 'MNST': 55, 'DG': 35, 'DLTR': 35,
    'EL': 45, 'CLX': 18
  },
  'Energy': {
    'XOM': 470, 'CVX': 310, 'COP': 140, 'SLB': 60, 'EOG': 70, 'MPC': 60, 'PSX': 55, 'VLO': 50, 'OXY': 55, 'WMB': 60,
    'KMI': 45, 'HES': 50, 'BKR': 35, 'HAL': 30, 'DVN': 30, 'FANG': 45, 'TRGP': 40, 'EQT': 25, 'MRO': 15, 'OKE': 35,
    'CTRA': 20, 'APA': 10
  },
  'Utilities': {
    'NEE': 160, 'SO': 80, 'DUK': 80, 'CEG': 70, 'SRE': 55, 'AEP': 55, 'D': 50, 'VST': 45, 'PCG': 40, 'PEG': 35,
    'EXC': 40, 'XEL': 35, 'ED': 35, 'EIX': 30, 'WEC': 30, 'AWK': 30, 'DTE': 25, 'PPL': 22, 'ES': 25, 'FE': 25,
    'AEE': 22, 'ATO': 20, 'CMS': 20, 'CNP': 18, 'NI': 18, 'LNT': 15, 'EVRG': 15, 'PNW': 12, 'AES': 12, 'ETR': 15
  },
  'Real Estate': {
    'PLD': 120, 'AMT': 100, 'EQIX': 75, 'PSA': 55, 'WELL': 50, 'SPG': 45, 'DLR': 55, 'O': 45, 'CCI': 45, 'VICI': 35,
    'SBAC': 30, 'EXR': 35, 'AVB': 30, 'EQR': 28, 'INVH': 25, 'VTR': 22, 'MAA': 20, 'ARE': 25, 'DOC': 18, 'UDR': 15,
    'ESS': 20, 'BXP': 12, 'CPT': 10, 'CBRE': 30, 'HST': 12, 'REG': 10, 'KIM': 15, 'FRT': 10, 'VNO': 8
  },
  'Materials': {
    'LIN': 200, 'APD': 65, 'SHW': 85, 'ECL': 65, 'FCX': 60, 'NEM': 50, 'CTVA': 55, 'DD': 30, 'NUE': 35, 'DOW': 40,
    'VMC': 35, 'MLM': 35, 'BALL': 20, 'STLD': 15, 'AVY': 15, 'ALB': 12, 'AMCR': 10, 'PKG': 18, 'IP': 12, 'CE': 10,
    'CF': 15, 'MOS': 10, 'EMN': 10, 'FMC': 8, 'IFF': 10
  }
};

// Browser compatibility - don't use module.exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SP500_BY_SECTOR, MARKET_CAPS_BY_SECTOR };
}
