import { ref, computed } from 'vue';
import tools from '@/utils/tools';

// 权限控制Hook
export function usePermission() {
  // 当前用户信息
  const currentUser = ref(tools.getCurrentUser());
  
  // 是否已登录
  const isLoggedIn = computed(() => {
    return currentUser.value !== null;
  });
  
  // 是否为管理员
  const isAdmin = computed(() => {
    return currentUser.value?.userType === 'admin';
  });

  // 是否为商家
  const isSeller = computed(() => {
    return currentUser.value?.userType === 'seller';
  });

  // 是否为普通用户
  const isUser = computed(() => {
    return currentUser.value?.userType === 'user';
  });
  
  // 检查是否有指定权限
  const hasPermission = (permission) => {
    if (!currentUser.value) return false;
    
    // 管理员默认拥有所有权限
    if (isAdmin.value) return true;
    
    // 检查用户权限列表
    const userPermissions = currentUser.value.permissions || [];
    return userPermissions.includes(permission);
  };
  
  // 检查是否有任意一个权限
  const hasAnyPermission = (permissions) => {
    if (!Array.isArray(permissions)) return false;
    return permissions.some(permission => hasPermission(permission));
  };
  
  // 检查是否有所有权限
  const hasAllPermissions = (permissions) => {
    if (!Array.isArray(permissions)) return false;
    return permissions.every(permission => hasPermission(permission));
  };
  
  // 检查是否有指定角色
  const hasRole = (role) => {
    if (!currentUser.value) return false;
    
    // 检查用户角色列表
    const userRoles = currentUser.value.roles || [];
    return userRoles.includes(role);
  };
  
  // 检查是否有任意一个角色
  const hasAnyRole = (roles) => {
    if (!Array.isArray(roles)) return false;
    return roles.some(role => hasRole(role));
  };
  
  // 检查是否有所有角色
  const hasAllRoles = (roles) => {
    if (!Array.isArray(roles)) return false;
    return roles.every(role => hasRole(role));
  };
  
  // 更新用户信息
  const updateCurrentUser = (userInfo) => {
    currentUser.value = userInfo;
    tools.setUserInfo(userInfo);
  };
  
  // 清除用户信息
  const clearCurrentUser = () => {
    currentUser.value = null;
    tools.clearUserInfo();
  };

  // 权限指令
  const vPermission = {
    mounted(el, binding) {
      const { value } = binding;
      if (value && !hasPermission(value)) {
        el.parentNode?.removeChild(el);
      }
    }
  };

  // 角色指令
  const vRole = {
    mounted(el, binding) {
      const { value } = binding;
      if (value && !hasRole(value)) {
        el.parentNode?.removeChild(el);
      }
    }
  };

  return {
    currentUser,
    isLoggedIn,
    isAdmin,
    isSeller,
    isUser,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    updateCurrentUser,
    clearCurrentUser,
    vPermission,
    vRole
  };
}