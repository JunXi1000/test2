import { reactive, type Ref } from 'vue'

/** 校验规则:返回 '' 表示通过,非空为错误文案(由页面用 t() 生成) */
export type FieldRule = (value: string) => string
export type Rules = Record<string, FieldRule>

/**
 * 字段级表单校验:复用 Checkout.vue 的 fieldErrors/fieldTouched 范式。
 * - rules 用 computed 传入,便于按角色/状态动态增删字段规则(如 Signup 的 storeName)。
 * - onInput 始终置 touched 并重算,失焦一次后输入即给出即时反馈。
 * - validateAll 按 rule-key 顺序返回非法字段名数组,首项即首个非法字段。
 */
export function useFormValidation(rules: Ref<Rules>, getValue: (name: string) => string) {
  const touched = reactive<Record<string, boolean>>({})
  const errors = reactive<Record<string, string>>({})

  function run(name: string, value: string): string {
    const rule = rules.value[name]
    return rule ? rule(value) : ''
  }

  function validateField(name: string, value: string): string {
    touched[name] = true
    errors[name] = run(name, value)
    return errors[name]
  }

  function onInput(name: string, value: string): void {
    touched[name] = true
    errors[name] = run(name, value)
  }

  function validateAll(): string[] {
    const invalid: string[] = []
    for (const name of Object.keys(rules.value)) {
      touched[name] = true
      errors[name] = run(name, getValue(name))
      if (errors[name]) invalid.push(name)
    }
    return invalid
  }

  function isFieldValid(name: string, value: string): boolean {
    return !!touched[name] && !errors[name] && value.trim() !== ''
  }

  function reset(): void {
    for (const k of Object.keys(errors)) delete errors[k]
    for (const k of Object.keys(touched)) delete touched[k]
  }

  return { touched, errors, validateField, onInput, validateAll, isFieldValid, reset }
}
