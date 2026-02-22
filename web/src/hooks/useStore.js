import { ref, reactive, readonly } from 'vue';

// 创建全局状态
const createStore = (initialState = {}) => {
  // 状态容器
  const state = reactive(initialState);
  
  // 获取状态快照
  const getState = () => readonly(state);
  
  // 更新状态
  const setState = (newState) => {
    Object.assign(state, newState);
  };
  
  // 重置状态
  const resetState = () => {
    Object.assign(state, initialState);
  };
  
  return {
    state: readonly(state),
    getState,
    setState,
    resetState
  };
};

// 用户状态
const userStore = createStore({
  userInfo: null,
  token: null,
  permissions: [],
  roles: []
});

// 应用配置状态
const configStore = createStore({
  theme: 'light',
  language: 'zh-CN',
  sidebar: {
    collapsed: false
  },
  settings: {
    showBreadcrumb: true,
    showTags: true,
    fixedHeader: true
  }
});

// 购物车状态
const cartStore = createStore({
  items: [],
  total: 0,
  count: 0
});

// 全局状态Hook
export function useStore() {
  // 用户状态操作
  const useUserStore = () => {
    const { state, setState, resetState } = userStore;
    
    // 设置用户信息
    const setUserInfo = (userInfo) => {
      setState({ userInfo });
    };
    
    // 设置token
    const setToken = (token) => {
      setState({ token });
    };
    
    // 设置权限
    const setPermissions = (permissions) => {
      setState({ permissions });
    };
    
    // 设置角色
    const setRoles = (roles) => {
      setState({ roles });
    };
    
    // 清除用户信息
    const clearUser = () => {
      resetState();
    };
    
    return {
      state,
      setUserInfo,
      setToken,
      setPermissions,
      setRoles,
      clearUser
    };
  };

  // 配置状态操作
  const useConfigStore = () => {
    const { state, setState } = configStore;
    
    // 切换主题
    const toggleTheme = () => {
      setState({
        theme: state.theme === 'light' ? 'dark' : 'light'
      });
    };
    
    // 切换语言
    const setLanguage = (language) => {
      setState({ language });
    };
    
    // 切换侧边栏
    const toggleSidebar = () => {
      setState({
        sidebar: {
          ...state.sidebar,
          collapsed: !state.sidebar.collapsed
        }
      });
    };
    
    // 更新设置
    const updateSettings = (settings) => {
      setState({
        settings: {
          ...state.settings,
          ...settings
        }
      });
    };
    
    return {
      state,
      toggleTheme,
      setLanguage,
      toggleSidebar,
      updateSettings
    };
  };

  // 购物车状态操作
  const useCartStore = () => {
    const { state, setState, resetState } = cartStore;
    
    // 添加商品到购物车
    const addToCart = (item) => {
      const items = [...state.items];
      const existingItem = items.find(i => i.id === item.id);
      
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        items.push({ ...item, quantity: 1 });
      }
      
      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const count = items.reduce((sum, item) => sum + item.quantity, 0);
      
      setState({ items, total, count });
    };
    
    // 从购物车移除商品
    const removeFromCart = (itemId) => {
      const items = state.items.filter(item => item.id !== itemId);
      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const count = items.reduce((sum, item) => sum + item.quantity, 0);
      
      setState({ items, total, count });
    };
    
    // 更新商品数量
    const updateQuantity = (itemId, quantity) => {
      const items = state.items.map(item => {
        if (item.id === itemId) {
          return { ...item, quantity };
        }
        return item;
      });
      
      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const count = items.reduce((sum, item) => sum + item.quantity, 0);
      
      setState({ items, total, count });
    };
    
    // 清空购物车
    const clearCart = () => {
      resetState();
    };
    
    return {
      state,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart
    };
  };

  return {
    useUserStore,
    useConfigStore,
    useCartStore
  };
}