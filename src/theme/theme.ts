export const Theme = {
  colors: {
    // Backgrounds
    background: '#07090E',
    surface: '#0F1422',
    card: '#151C30',
    cardElevated: '#1B243D',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    cardBorderHighlight: 'rgba(59, 130, 246, 0.3)',
    
    // Status & Financial Indicators
    bullish: '#00E599', // Vivid Emerald Green (한국/글로벌 상승)
    bullishGlow: 'rgba(0, 229, 153, 0.15)',
    bullishText: '#00E599',
    
    bearish: '#FF4262', // Vivid Crimson Red (하락)
    bearishGlow: 'rgba(255, 66, 98, 0.15)',
    bearishText: '#FF4262',
    
    neutral: '#94A3B8',
    neutralGlow: 'rgba(148, 163, 184, 0.12)',

    // Accents
    primary: '#3B82F6', // Electric Blue
    primaryGlow: 'rgba(59, 130, 246, 0.25)',
    secondary: '#8B5CF6', // Neon Purple
    accentCyan: '#06B6D4',
    accentAmber: '#F59E0B',
    accentGold: '#FFD700',

    // Text hierarchy
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textDim: '#475569',

    // UI elements
    tabBarBackground: '#0B0F1A',
    tabBarBorder: 'rgba(255, 255, 255, 0.06)',
    activeTab: '#38BDF8',
    inactiveTab: '#64748B',
    
    separator: 'rgba(255, 255, 255, 0.06)',
    badgeBg: 'rgba(255, 255, 255, 0.06)',
  },

  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System',
      bold: 'System',
    },
    sizes: {
      xs: 11,
      sm: 13,
      base: 15,
      md: 17,
      lg: 20,
      xl: 24,
      xxl: 28,
      hero: 34,
    }
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    hero: 32,
  },

  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  }
};
