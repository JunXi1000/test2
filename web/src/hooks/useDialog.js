import { ref, reactive } from 'vue';
import message from '@/utils/message';
import http from '@/utils/request';

// 对话框处理Hook
export function useDialog(options = {}) {
  // 对话框可见性
  const visible = ref(false);
  
  // 对话框标题
  const title = ref(options.title || '');
  
  // 对话框加载状态
  const loading = ref(false);
  
  // 表单数据
  const formData = reactive(options.initialValues || {});
  
  // 打开对话框
  const openDialog = (row) => {
    visible.value = true;
    title.value = options.title || '';
    
    // 编辑模式
    if (row) {
      title.value = options.editTitle || `编辑${options.title}`;
      Object.assign(formData, options.initialValues || {}, row);
    } 
    // 新增模式
    else {
      title.value = options.addTitle || `新增${options.title}`;
      Object.assign(formData, options.initialValues || {});
    }
    
    // 执行打开回调
    if (options.onOpen) {
      options.onOpen(formData);
    }
  };

  // 关闭对话框
  const closeDialog = () => {
    visible.value = false;
    loading.value = false;
    
    // 重置表单数据
    Object.assign(formData, options.initialValues || {});
    
    // 执行关闭回调
    if (options.onClose) {
      options.onClose();
    }
  };

  // 提交表单
  const submitForm = async (formRef) => {
    if (!formRef) return;
    
    try {
      // 表单验证
      await formRef.validate();
      
      loading.value = true;
      let response;
      
      // 编辑模式
      if (formData.id) {
        if (!options.updateApi) {
          throw new Error('未配置更新接口');
        }
        response = await http.put(`${options.updateApi}/${formData.id}`, formData);
      } 
      // 新增模式
      else {
        if (!options.createApi) {
          throw new Error('未配置创建接口');
        }
        response = await http.post(options.createApi, formData);
      }
      
      if (response.code === 200) {
        message.success(formData.id ? '更新成功' : '创建成功');
        closeDialog();
        
        // 执行成功回调
        if (options.onSuccess) {
          options.onSuccess(response.data);
        }
      }
    } catch (error) {
      if (error === 'cancel') return;
      
      // 执行失败回调
      if (options.onError) {
        options.onError(error);
      } else {
        message.error(error.message || '操作失败');
      }
    } finally {
      loading.value = false;
    }
  };

  // 获取详情
  const getDetail = async (id) => {
    if (!options.detailApi || !id) return;
    
    try {
      loading.value = true;
      const response = await http.get(`${options.detailApi}/${id}`);
      
      if (response.code === 200) {
        Object.assign(formData, response.data);
        
        // 执行获取详情成功回调
        if (options.onDetailSuccess) {
          options.onDetailSuccess(response.data);
        }
      }
    } catch (error) {
      // 执行获取详情失败回调
      if (options.onDetailError) {
        options.onDetailError(error);
      } else {
        message.error('获取详情失败');
      }
    } finally {
      loading.value = false;
    }
  };

  return {
    visible,
    title,
    loading,
    formData,
    openDialog,
    closeDialog,
    submitForm,
    getDetail
  };
}