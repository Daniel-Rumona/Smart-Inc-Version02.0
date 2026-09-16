import type { ThemeConfig } from 'antd'

export const appAccent = {
  primary: '#6D5DFB',
  primaryHover: '#7C6CFF',
  secondary: '#8B5CF6',
  gradient: 'linear-gradient(135deg, #6D5DFB 0%, #8B5CF6 50%, #3B82F6 100%)',
}

const sharedCompactTokens = {
  borderRadius: 12,
  fontSize: 13,
  fontSizeSM: 12,
  fontSizeLG: 15,
  controlHeight: 34,
  controlHeightSM: 28,
  controlHeightLG: 38,
  padding: 14,
  paddingSM: 10,
  paddingXS: 6,
  margin: 14,
  marginSM: 10,
  marginXS: 6,
  lineHeight: 1.45,
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

export const lightTheme: ThemeConfig = {
  token: {
    ...sharedCompactTokens,
    colorPrimary: appAccent.primary,
    colorBgLayout: '#f6f7fb',
    colorBgContainer: '#ffffff',
    colorTextBase: '#111827',
  },
  components: {
    Layout: {
      bodyBg: '#f6f7fb',
      headerBg: '#ffffff',
      siderBg: '#121426',
    },
    Menu: {
      darkItemBg: '#121426',
      darkSubMenuItemBg: '#121426',
      darkItemSelectedBg: appAccent.primary,
      darkItemHoverBg: 'rgba(109, 93, 251, 0.18)',
      itemHeight: 38,
      itemBorderRadius: 14,
      fontSize: 13,
    },
    Card: {
      borderRadiusLG: 18,
      paddingLG: 18,
      headerHeight: 48,
    },
    Button: {
      borderRadius: 999,
      controlHeight: 34,
      controlHeightLG: 38,
      fontSize: 13,
    },
    Input: {
      controlHeight: 34,
      controlHeightLG: 38,
      fontSize: 13,
    },
    Select: {
      controlHeight: 34,
      controlHeightLG: 38,
      fontSize: 13,
    },
    DatePicker: {
      controlHeight: 34,
      controlHeightLG: 38,
      fontSize: 13,
    },
    Drawer: {
      borderRadiusLG: 18,
    },
    Modal: {
      borderRadiusLG: 18,
    },
    Table: {
      fontSize: 13,
      cellPaddingBlock: 10,
      cellPaddingInline: 12,
    },
  },
}

export const darkTheme: ThemeConfig = {
  token: {
    ...sharedCompactTokens,
    colorPrimary: appAccent.primaryHover,
    colorBgBase: '#0f1117',
    colorBgLayout: '#0f1117',
    colorBgContainer: '#171923',
    colorTextBase: '#f5f7fb',
  },
  components: {
    Layout: {
      bodyBg: '#0f1117',
      headerBg: '#171923',
      siderBg: '#10121d',
    },
    Menu: {
      darkItemBg: '#10121d',
      darkSubMenuItemBg: '#10121d',
      darkItemSelectedBg: appAccent.primary,
      darkItemHoverBg: 'rgba(139, 92, 246, 0.22)',
      itemHeight: 38,
      itemBorderRadius: 14,
      fontSize: 13,
    },
    Card: {
      borderRadiusLG: 18,
      paddingLG: 18,
      headerHeight: 48,
    },
    Button: {
      borderRadius: 999,
      controlHeight: 34,
      controlHeightLG: 38,
      fontSize: 13,
    },
    Input: {
      controlHeight: 34,
      controlHeightLG: 38,
      fontSize: 13,
    },
    Select: {
      controlHeight: 34,
      controlHeightLG: 38,
      fontSize: 13,
    },
    DatePicker: {
      controlHeight: 34,
      controlHeightLG: 38,
      fontSize: 13,
    },
    Drawer: {
      borderRadiusLG: 18,
    },
    Modal: {
      borderRadiusLG: 18,
    },
    Table: {
      fontSize: 13,
      cellPaddingBlock: 10,
      cellPaddingInline: 12,
    },
  },
}
