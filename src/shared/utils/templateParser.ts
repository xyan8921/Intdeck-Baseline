/**
 * 模板解析工具
 * 
 * 从 promptTemplate 中提取参数占位符，用于动态生成表单
 */

/**
 * 从模板字符串中提取参数名
 * 
 * @example
 * extractParams("请为{{age}}岁孩子策划{{theme}}主题的生日派对")
 * // => ["age", "theme"]
 */
export function extractParams(template: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const params: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    if (!params.includes(match[1])) {
      params.push(match[1]);
    }
  }

  return params;
}

/**
 * 渲染模板（替换占位符）
 * 
 * @example
 * renderTemplate("请为{{age}}岁孩子策划{{theme}}主题的生日派对", { age: 5, theme: "恐龙" })
 * // => "请为5岁孩子策划恐龙主题的生日派对"
 */
export function renderTemplate(
  template: string,
  params: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = params[key];
    return value !== undefined && value !== null ? String(value) : `{{${key}}}`;
  });
}

/**
 * 生成参数表单字段配置
 */
export interface ParamFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

/**
 * 根据参数名生成字段配置（智能推断类型）
 */
export function generateFieldConfig(paramName: string): ParamFieldConfig {
  const lowerName = paramName.toLowerCase();

  // 数字类型推断
  if (
    lowerName.includes('age') ||
    lowerName.includes('budget') ||
    lowerName.includes('price') ||
    lowerName.includes('days') ||
    lowerName.includes('weeks') ||
    lowerName.includes('count') ||
    lowerName.includes('number')
  ) {
    return {
      name: paramName,
      label: getLabel(paramName),
      type: 'number',
      required: true,
      placeholder: `请输入${getLabel(paramName)}`,
    };
  }

  // 文本区域推断
  if (
    lowerName.includes('requirements') ||
    lowerName.includes('description') ||
    lowerName.includes('content') ||
    lowerName.includes('details')
  ) {
    return {
      name: paramName,
      label: getLabel(paramName),
      type: 'textarea',
      required: true,
      placeholder: `请输入${getLabel(paramName)}`,
    };
  }

  // 默认文本输入
  return {
    name: paramName,
    label: getLabel(paramName),
    type: 'text',
    required: true,
    placeholder: `请输入${getLabel(paramName)}`,
  };
}

/**
 * 获取参数的中文标签
 */
function getLabel(paramName: string): string {
  const labelMap: Record<string, string> = {
    age: '年龄',
    theme: '主题',
    budget: '预算',
    location: '地点',
    company: '公司名称',
    position: '职位',
    requirements: '要求',
    eventType: '活动类型',
    problem: '问题描述',
    days: '天数',
    destination: '目的地',
    preferences: '偏好',
    exam: '考试名称',
    weeks: '周数',
    level: '当前水平',
  };

  return labelMap[paramName] || paramName;
}
