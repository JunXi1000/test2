import { ref, reactive, onMounted } from 'vue';
import { validator } from '@/utils/validator';
import message from '@/utils/message';

// 表单处理Hook
export function useForm(options = {}) {
  // 表单引用
  const formRef = ref(null);
  
  // 表单数据
  const formData = reactive(options.initialValues || {});
  
  // 表单验证规则
  const rules = reactive(options.rules ? validator.createRules(options.rules) : {});
  
  // 提交状态
  const submitting = ref(false);
  
  // 重置表单
  const resetForm = () => {
    if (formRef.value) {
      formRef.value.resetFields();
      // 如果有自定义重置逻辑，执行它
      if (options.onReset) {
        options.onReset(formData);
      }
    }
  };

  // 验证表单
  const validateForm = async () => {
    if (!formRef.value) return false;
    try {
      await validator.validateForm(formRef.value);
      return true;
    } catch (error) {
      return false;
    }
  };

  // 提交表单
  const submitForm = async () => {
    if (!formRef.value || !options.onSubmit) return;
    
    try {
      // 验证表单
      const valid = await validateForm();
      if (!valid) return;
      
      // 设置提交状态
      submitting.value = true;
      
      // 执行提交
      await options.onSubmit(formData);
      
      // 提交成功后的处理
      if (options.submitSuccessMessage) {
        message.success(options.submitSuccessMessage);
      }
      
      // 是否重置表单
      if (options.resetAfterSubmit) {
        resetForm();
      }
      
    } catch (error) {
      // 提交失败处理
      if (options.onError) {
        options.onError(error);
      } else {
        message.error(error.message || '提交失败');
      }
    } finally {
      submitting.value = false;
    }
  };

  // 验证单个字段
  const validateField = async (field) => {
    if (!formRef.value) return false;
    try {
      await validator.validateField(formRef.value, field);
      return true;
    } catch (error) {
      return false;
    }
  };

  // 设置表单字段值
  const setFieldValue = (field, value) => {
    if (formData.hasOwnProperty(field)) {
      formData[field] = value;
    }
  };

  // 设置多个字段值
  const setFieldsValue = (values) => {
    Object.keys(values).forEach(key => {
      setFieldValue(key, values[key]);
    });
  };

  // 获取表单数据
  const getFormData = () => {
    return { ...formData };
  };

  // 组件挂载时的处理
  onMounted(() => {
    if (options.onMounted) {
      options.onMounted(formData);
    }
  });

  return {
    formRef,
    formData,
    rules,
    submitting,
    resetForm,
    validateForm,
    submitForm,
    validateField,
    setFieldValue,
    setFieldsValue,
    getFormData
  };
}