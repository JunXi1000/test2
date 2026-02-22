import { ref, reactive, onMounted } from 'vue';
import message from '@/utils/message';
import http from '@/utils/request';

// 表格处理Hook
export function useTable(options = {}) {
  // 表格数据
  const tableData = ref([]);
  
  // 加载状态
  const loading = ref(false);
  
  // 分页配置
  const pagination = reactive({
    currentPage: 1,
    pageSize: options.pageSize || 10,
    total: 0,
    pageSizes: options.pageSizes || [10, 20, 50, 100],
    layout: options.layout || 'total, sizes, prev, pager, next, jumper'
  });
  
  // 查询参数
  const queryParams = reactive({
    ...options.initialQuery,
    pageNum: 1,
    pageSize: pagination.pageSize
  });
  
  // 选中的行
  const selectedRows = ref([]);
  
  // 获取表格数据
  const loadData = async () => {
    if (!options.api) return;
    
    try {
      loading.value = true;
      const response = await http.get(options.api, queryParams);
      
      if (response.code === 200) {
        tableData.value = response.data.list || [];
        pagination.total = response.data.total || 0;
        
        // 执行成功回调
        if (options.onLoadSuccess) {
          options.onLoadSuccess(response.data);
        }
      }
    } catch (error) {
      // 执行失败回调
      if (options.onLoadError) {
        options.onLoadError(error);
      } else {
        message.error('获取数据失败');
      }
    } finally {
      loading.value = false;
    }
  };

  // 刷新表格数据
  const refresh = () => {
    loadData();
  };

  // 重置查询参数
  const resetQuery = () => {
    Object.assign(queryParams, {
      ...options.initialQuery,
      pageNum: 1,
      pageSize: pagination.pageSize
    });
    loadData();
  };

  // 处理页码改变
  const handleCurrentChange = (page) => {
    queryParams.pageNum = page;
    loadData();
  };

  // 处理每页条数改变
  const handleSizeChange = (size) => {
    queryParams.pageSize = size;
    pagination.pageSize = size;
    queryParams.pageNum = 1;
    loadData();
  };

  // 处理行选择改变
  const handleSelectionChange = (selection) => {
    selectedRows.value = selection;
    if (options.onSelectionChange) {
      options.onSelectionChange(selection);
    }
  };

  // 删除单行数据
  const deleteRow = async (row, confirmMessage = '确定要删除该记录吗？') => {
    if (!options.deleteApi) return;
    
    try {
      await message.confirm(confirmMessage);
      const response = await http.delete(`${options.deleteApi}/${row.id}`);
      
      if (response.code === 200) {
        message.success('删除成功');
        loadData();
        
        // 执行删除成功回调
        if (options.onDeleteSuccess) {
          options.onDeleteSuccess(row);
        }
      }
    } catch (error) {
      if (error !== 'cancel') {
        message.error('删除失败');
        // 执行删除失败回调
        if (options.onDeleteError) {
          options.onDeleteError(error);
        }
      }
    }
  };

  // 批量删除
  const batchDelete = async (confirmMessage = '确定要删除选中的记录吗？') => {
    if (!options.batchDeleteApi || selectedRows.value.length === 0) return;
    
    try {
      await message.confirm(confirmMessage);
      const ids = selectedRows.value.map(row => row.id);
      const response = await http.delete(options.batchDeleteApi, { ids });
      
      if (response.code === 200) {
        message.success('批量删除成功');
        loadData();
        selectedRows.value = [];
        
        // 执行批量删除成功回调
        if (options.onBatchDeleteSuccess) {
          options.onBatchDeleteSuccess(ids);
        }
      }
    } catch (error) {
      if (error !== 'cancel') {
        message.error('批量删除失败');
        // 执行批量删除失败回调
        if (options.onBatchDeleteError) {
          options.onBatchDeleteError(error);
        }
      }
    }
  };

  // 导出数据
  const exportData = async () => {
    if (!options.exportApi) return;
    
    try {
      loading.value = true;
      const response = await http.download(options.exportApi, queryParams);
      
      // 创建下载链接
      const blob = new Blob([response.data]);
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = options.exportFileName || 'export.xlsx';
      link.click();
      window.URL.revokeObjectURL(link.href);
      
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    } finally {
      loading.value = false;
    }
  };

  // 组件挂载时加载数据
  onMounted(() => {
    if (options.immediate !== false) {
      loadData();
    }
  });

  return {
    tableData,
    loading,
    pagination,
    queryParams,
    selectedRows,
    loadData,
    refresh,
    resetQuery,
    handleCurrentChange,
    handleSizeChange,
    handleSelectionChange,
    deleteRow,
    batchDelete,
    exportData
  };
}