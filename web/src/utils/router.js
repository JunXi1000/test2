import { useRouter, useRoute } from 'vue-router';
import cache from './cache';
import logger from './logger';
import message from './message';

// 路由工具类
const router = {
  // 路由导航
  navigation: {
    // 获取当前路由信息
    getCurrentRoute() {
      return useRoute();
    },

    // 获取路由器实例
    getRouter() {
      return useRouter();
    },

    // 导航到指定路由
    async navigateTo({
      path,
      query = {},
      params = {},
      replace = false,
      keepQuery = false
    }) {
      try {
        const router = this.getRouter();
        const currentRoute = this.getCurrentRoute();

        // 合并查询参数
        const finalQuery = keepQuery
          ? { ...currentRoute.query, ...query }
          : query;

        // 构建路由配置
        const routeConfig = {
          path,
          query: finalQuery,
          params
        };

        // 执行导航
        await (replace ? router.replace(routeConfig) : router.push(routeConfig));
        return true;
      } catch (error) {
        logger.error('Navigation failed:', error);
        return false;
      }
    },

    // 返回上一页
    async goBack(fallbackPath = '/') {
      const router = this.getRouter();
      if (window.history.length > 1) {
        router.back();
      } else {
        await this.navigateTo({ path: fallbackPath });
      }
    },

    // 刷新当前页面
    async refresh() {
      const route = this.getCurrentRoute();
      await this.navigateTo({
        path: route.path,
        query: route.query,
        params: route.params,
        replace: true
      });
    }
  },

  // 路由权限
  permission: {
    // 路由白名单
    whiteList: [
      '/login',
      '/register',
      '/forgot-password',
      '/404',
      '/403',
      '/500'
    ],

    // 检查路由权限
    async checkPermission(to) {
      // 白名单直接通过
      if (this.whiteList.includes(to.path)) {
        return true;
      }

      // 获取token
      const token = cache.local.get('token');
      if (!token) {
        message.warning('请先登录');
        await router.navigation.navigateTo({
          path: '/login',
          query: { redirect: to.fullPath }
        });
        return false;
      }

      // 获取用户权限
      const userPermissions = cache.local.get('permissions') || [];

      // 检查路由是否需要权限
      if (to.meta?.permissions) {
        const hasPermission = to.meta.permissions.some(permission =>
          userPermissions.includes(permission)
        );

        if (!hasPermission) {
          message.error('没有访问权限');
          await router.navigation.navigateTo({ path: '/403' });
          return false;
        }
      }

      // 检查路由是否需要角色
      if (to.meta?.roles) {
        const userRoles = cache.local.get('roles') || [];
        const hasRole = to.meta.roles.some(role =>
          userRoles.includes(role)
        );

        if (!hasRole) {
          message.error('没有访问权限');
          await router.navigation.navigateTo({ path: '/403' });
          return false;
        }
      }

      return true;
    },

    // 添加路由权限守卫
    setupPermissionGuard() {
      const router = this.navigation.getRouter();

      router.beforeEach(async (to, from, next) => {
        try {
          const hasPermission = await this.checkPermission(to);
          if (hasPermission) {
            next();
          }
        } catch (error) {
          logger.error('Permission check failed:', error);
          next('/500');
        }
      });
    }
  },

  // 路由历史
  history: {
    // 获取路由历史
    get() {
      return cache.session.get('routeHistory') || [];
    },

    // 添加路由历史
    add(route) {
      const history = this.get();
      const maxLength = 10; // 最大历史记录数

      // 移除重复记录
      const index = history.findIndex(item => item.path === route.path);
      if (index !== -1) {
        history.splice(index, 1);
      }

      // 添加新记录
      history.unshift({
        path: route.path,
        name: route.name,
        title: route.meta?.title,
        timestamp: Date.now()
      });

      // 限制历史记录数量
      if (history.length > maxLength) {
        history.pop();
      }

      cache.session.set('routeHistory', history);
    },

    // 清除路由历史
    clear() {
      cache.session.remove('routeHistory');
    }
  },

  // 路由分析
  analytics: {
    // 记录路由访问
    logRouteAccess(route) {
      try {
        const accessLog = {
          path: route.path,
          name: route.name,
          title: route.meta?.title,
          timestamp: Date.now(),
          query: route.query,
          params: route.params
        };

        // 获取现有日志
        const logs = cache.local.get('routeAccessLogs') || [];
        logs.unshift(accessLog);

        // 限制日志数量
        const maxLogs = 100;
        if (logs.length > maxLogs) {
          logs.length = maxLogs;
        }

        cache.local.set('routeAccessLogs', logs);
      } catch (error) {
        logger.error('Log route access failed:', error);
      }
    },

    // 获取路由访问日志
    getAccessLogs() {
      return cache.local.get('routeAccessLogs') || [];
    },

    // 清除路由访问日志
    clearAccessLogs() {
      cache.local.remove('routeAccessLogs');
    },

    // 获取路由访问统计
    getAccessStats() {
      const logs = this.getAccessLogs();
      const stats = {
        total: logs.length,
        pathStats: {},
        timeStats: {
          daily: {},
          hourly: {}
        }
      };

      logs.forEach(log => {
        // 路径统计
        if (!stats.pathStats[log.path]) {
          stats.pathStats[log.path] = 0;
        }
        stats.pathStats[log.path]++;

        // 时间统计
        const date = new Date(log.timestamp);
        const dateKey = date.toISOString().split('T')[0];
        const hourKey = date.getHours();

        if (!stats.timeStats.daily[dateKey]) {
          stats.timeStats.daily[dateKey] = 0;
        }
        stats.timeStats.daily[dateKey]++;

        if (!stats.timeStats.hourly[hourKey]) {
          stats.timeStats.hourly[hourKey] = 0;
        }
        stats.timeStats.hourly[hourKey]++;
      });

      return stats;
    }
  }
};

export default router;